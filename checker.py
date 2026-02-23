import argparse
import csv
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import List, Optional, Tuple
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn

console = Console()

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "*/*",
}

@dataclass
class Entry:
    title: str
    url: str
    category: str = ""
    logo_url: str = ""


EXTINF_ATTR_RE = re.compile(r'([A-Za-z0-9-]+)\s*=\s*"([^"]*)"')


def _sanitize_attr(value: str) -> str:
    return value.replace('"', "'").strip()


def _parse_extinf(line: str) -> Tuple[str, str, str]:
    attrs = {k.lower(): v.strip() for k, v in EXTINF_ATTR_RE.findall(line)}
    title = line.split(",", 1)[-1].strip() if "," in line else "Stream"
    channel_name = attrs.get("tvg-name") or title or "Stream"
    category = attrs.get("group-title", "")
    logo_url = attrs.get("tvg-logo", "")
    return channel_name, category, logo_url


def _title_from_url(url: str) -> str:
    try:
        parsed = urlparse(url)
        query = parse_qs(parsed.query)
        if query.get("id") and query["id"][0].strip():
            return query["id"][0].strip()
        tail = parsed.path.rstrip("/").split("/")[-1]
        if tail:
            return tail
    except Exception:
        pass
    return "Stream"

def parse_m3u(path: str) -> List[Entry]:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = [l.rstrip("\n") for l in f]

    entries: List[Entry] = []
    current_title: Optional[str] = None
    current_category: str = ""
    current_logo_url: str = ""

    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("#EXTINF"):
            current_title, current_category, current_logo_url = _parse_extinf(line)
        elif line.startswith("#"):
            continue
        else:
            entries.append(
                Entry(
                    title=current_title or _title_from_url(line),
                    url=line,
                    category=current_category,
                    logo_url=current_logo_url,
                )
            )
            current_title = None
            current_category = ""
            current_logo_url = ""

    return entries

def write_m3u(path: str, entries: List[Entry]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n\n")
        for e in entries:
            safe_title = _sanitize_attr(e.title or "Stream")
            attrs = [f'tvg-name="{safe_title}"']
            if e.category:
                attrs.append(f'group-title="{_sanitize_attr(e.category)}"')
            if e.logo_url:
                attrs.append(f'tvg-logo="{_sanitize_attr(e.logo_url)}"')
            f.write(f"#EXTINF:-1 {' '.join(attrs)},{safe_title}\n")
            f.write(f"{e.url}\n")

def is_m3u(text: str) -> bool:
    return text.lstrip().startswith("#EXTM3U")

def extract_variant_url(base_url: str, text: str) -> Optional[str]:
    # Master playlist -> non-comment line after #EXT-X-STREAM-INF
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for i, line in enumerate(lines):
        if line.startswith("#EXT-X-STREAM-INF"):
            if i + 1 < len(lines):
                nxt = lines[i + 1].strip()
                if nxt and not nxt.startswith("#"):
                    return urljoin(base_url, nxt)
    return None

def extract_first_media_uri(base_url: str, text: str) -> Optional[str]:
    # Media playlist -> first non-comment URI (segment or nested playlist)
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        return urljoin(base_url, line)
    return None

def fetch_text(url: str, timeout: float, headers: dict, max_bytes: int = 512 * 1024) -> Tuple[int, str, str]:
    """
    Fetch text safely with an upper byte limit so non-playlist streaming URLs
    cannot block by sending an endless body.
    """
    r = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True, stream=True)
    try:
        chunks = []
        total = 0
        for chunk in r.iter_content(chunk_size=8192):
            if not chunk:
                continue
            chunks.append(chunk)
            total += len(chunk)
            if total >= max_bytes:
                break
        body = b"".join(chunks)
        enc = r.encoding or "utf-8"
        text = body.decode(enc, errors="ignore")
        return r.status_code, text, r.url
    finally:
        r.close()

def fetch_head_or_small_get(url: str, timeout: float, headers: dict) -> int:
    # Some servers block HEAD. Try HEAD then fallback to GET streamed.
    try:
        r = requests.head(url, headers=headers, timeout=timeout, allow_redirects=True)
        try:
            if r.status_code in (405, 403) or r.status_code >= 500:
                raise RuntimeError("HEAD not reliable")
            return r.status_code
        finally:
            r.close()
    except Exception:
        r = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True, stream=True)
        try:
            return r.status_code
        finally:
            r.close()

def check_live(m3u8_url: str, timeout: float, headers: dict, verify_segment: bool) -> Tuple[bool, str]:
    """
    Returns (is_live, reason)
    """
    try:
        status, text, final_url = fetch_text(m3u8_url, timeout=timeout, headers=headers)
        if status != 200:
            return False, f"playlist_http_{status}"
        if not is_m3u(text):
            return False, "not_m3u8"

        variant = extract_variant_url(final_url, text)
        if variant:
            status2, text2, final_url2 = fetch_text(variant, timeout=timeout, headers=headers)
            if status2 != 200:
                return False, f"variant_http_{status2}"
            if not is_m3u(text2):
                return False, "variant_not_m3u8"

            if verify_segment:
                seg = extract_first_media_uri(final_url2, text2)
                if seg:
                    s = fetch_head_or_small_get(seg, timeout=timeout, headers=headers)
                    if s != 200:
                        return False, f"segment_http_{s}"
            return True, "ok_master"

        # media playlist
        if verify_segment:
            seg = extract_first_media_uri(final_url, text)
            if seg:
                s = fetch_head_or_small_get(seg, timeout=timeout, headers=headers)
                if s != 200:
                    return False, f"segment_http_{s}"
        return True, "ok_media"

    except requests.exceptions.Timeout:
        return False, "timeout"
    except Exception as e:
        return False, f"error:{type(e).__name__}"

def save_report_csv(path: str, rows: List[dict]) -> None:
    fieldnames = ["title", "url", "status", "reason"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

def main():
    ap = argparse.ArgumentParser(description="Check which M3U8 streams are live and generate filtered M3U.")
    ap.add_argument("input", help="Input .m3u file")
    ap.add_argument("--out-live", default="live_only.m3u", help="Output .m3u with live entries only")
    ap.add_argument("--out-dead", default="dead_only.m3u", help="Output .m3u with dead entries only")
    ap.add_argument("--report", default="report.csv", help="CSV report path")
    ap.add_argument("--timeout", type=float, default=8.0, help="Request timeout seconds")
    ap.add_argument("--delay", type=float, default=0.15, help="Delay between checks (seconds)")
    ap.add_argument("--verify-segment", action="store_true", help="Also validate a media segment URL (more accurate, slower)")
    ap.add_argument("--max", type=int, default=0, help="Only check first N entries (0 = all)")
    args = ap.parse_args()

    if not os.path.exists(args.input):
        console.print(f"[red]Input file not found:[/red] {args.input}")
        sys.exit(2)

    entries = parse_m3u(args.input)
    if args.max and args.max > 0:
        entries = entries[: args.max]

    if not entries:
        console.print("[red]No stream entries found in M3U.[/red]")
        sys.exit(3)

    headers = dict(DEFAULT_HEADERS)

    live: List[Entry] = []
    dead: List[Entry] = []
    report_rows: List[dict] = []

    console.print(f"Loaded {len(entries)} entries. Checking...")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Scanning", total=len(entries))
        for e in entries:
            ok, reason = check_live(e.url, timeout=args.timeout, headers=headers, verify_segment=args.verify_segment)
            if ok:
                live.append(e)
                report_rows.append({"title": e.title, "url": e.url, "status": "LIVE", "reason": reason})
            else:
                dead.append(e)
                report_rows.append({"title": e.title, "url": e.url, "status": "DEAD", "reason": reason})

            progress.advance(task)
            time.sleep(max(args.delay, 0))

    write_m3u(args.out_live, live)
    write_m3u(args.out_dead, dead)
    save_report_csv(args.report, report_rows)

    console.print("")
    console.print(f"[green]LIVE:[/green] {len(live)}  |  [red]DEAD:[/red] {len(dead)}")
    console.print(f"Saved: {args.out_live}, {args.out_dead}, {args.report}")

if __name__ == "__main__":
    main()
