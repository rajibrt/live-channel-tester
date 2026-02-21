import io
import json
import re
import secrets
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List
from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

from checker import Entry, check_live, fetch_text, parse_m3u
from env_loader import load_dotenv_if_exists
from firebase_publisher import publish_curated_playlist
from supabase_publisher import publish_curated_playlist_supabase

app = FastAPI(title="M3U Local Agent", version="1.0.0")
load_dotenv_if_exists()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "*/*",
}

MERGE_CACHE: Dict[str, str] = {}
DOWNLOAD_CACHE: Dict[str, str] = {}
JOBS: Dict[str, dict] = {}


def _sanitize_attr(value: str) -> str:
    return value.replace('"', "'").strip()


def _normalize_url(value: str) -> str:
    return value.strip()


def _normalize_title(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _extract_manifest_name(text: str) -> str:
    media_match = re.search(r'#EXT-X-MEDIA:[^\n]*\bNAME="([^"]+)"', text)
    if media_match:
        return media_match.group(1).strip()
    stream_match = re.search(r'#EXT-X-STREAM-INF:[^\n]*\bNAME="([^"]+)"', text)
    if stream_match:
        return stream_match.group(1).strip()
    return ""


def _looks_placeholder_title(title: str) -> bool:
    t = (title or "").strip().lower()
    if not t or t == "stream":
        return True
    return bool(re.fullmatch(r"\d+", t))


def _id_from_url(url: str) -> str:
    try:
        q = parse_qs(urlparse(url).query)
        if q.get("id") and q["id"][0].strip():
            return q["id"][0].strip()
    except Exception:
        pass
    return ""


def _resolve_title_from_manifest(entry: Entry, timeout: float, headers: dict) -> str:
    base_title = (entry.title or "").strip()
    if not _looks_placeholder_title(base_title):
        return base_title
    try:
        status, text, _ = fetch_text(entry.url, timeout=timeout, headers=headers)
        if status == 200:
            detected = _extract_manifest_name(text)
            if detected:
                return detected
    except Exception:
        pass
    return base_title or _id_from_url(entry.url) or "Stream"


def _build_entries_m3u_text(entries: List[Entry]) -> str:
    buffer = io.StringIO()
    buffer.write("#EXTM3U\n\n")
    for e in entries:
        safe_title = _sanitize_attr(e.title or "Stream")
        attrs = [f'tvg-name="{safe_title}"']
        if e.category:
            attrs.append(f'group-title="{_sanitize_attr(e.category)}"')
        if e.logo_url:
            attrs.append(f'tvg-logo="{_sanitize_attr(e.logo_url)}"')
        buffer.write(f"#EXTINF:-1 {' '.join(attrs)},{safe_title}\n")
        buffer.write(f"{e.url}\n")
    return buffer.getvalue()


def _build_curated_m3u_text(channels: List[dict]) -> str:
    sorted_channels = sorted(
        channels,
        key=lambda c: (
            (c.get("category") or "").strip().lower(),
            (c.get("name") or "").strip().lower(),
            (c.get("url") or "").strip().lower(),
        ),
    )
    buffer = io.StringIO()
    buffer.write("#EXTM3U\n\n")
    for c in sorted_channels:
        name = _sanitize_attr(c["name"])
        category = _sanitize_attr(c.get("category", ""))
        logo_url = _sanitize_attr(c.get("logo_url", ""))
        extinf = f'#EXTINF:-1 tvg-name="{name}" group-title="{category}" tvg-logo="{logo_url}",{name}'
        buffer.write(extinf + "\n")
        buffer.write(c["url"].strip() + "\n")
    return buffer.getvalue()


def _store_job(live_entries: List[Entry]) -> str:
    job_id = secrets.token_urlsafe(12)
    JOBS[job_id] = {
        "live_streams": [
            {"title": e.title, "url": e.url, "category": e.category, "logo_url": e.logo_url}
            for e in live_entries
        ],
        "channels": [],
        "name_set": set(),
        "url_set": set(),
    }
    DOWNLOAD_CACHE[job_id] = _build_entries_m3u_text(live_entries)
    return job_id


def _parse_upload(upload: UploadFile) -> List[Entry]:
    raw = upload.file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".m3u") as tmp:
        temp_path = Path(tmp.name)
        tmp.write(raw)
    entries = parse_m3u(str(temp_path))
    temp_path.unlink(missing_ok=True)
    return entries


@app.get("/health")
def health():
    return {"ok": True, "service": "m3u-local-agent", "time": datetime.utcnow().isoformat() + "Z"}


@app.post("/test-stream")
@app.post("/api/test-stream")
def test_stream(
    playlist: UploadFile = File(...),
    timeout: float = Form(10.0),
    delay: float = Form(0.2),
    max_items: int = Form(0),
    verify_segment: bool = Form(True),
):
    entries = _parse_upload(playlist)
    if max_items > 0:
        entries = entries[:max_items]
    if not entries:
        raise HTTPException(status_code=400, detail="No stream entries found in playlist.")

    def generate():
        live_count = 0
        dead_count = 0
        total = len(entries)
        live_entries: List[Entry] = []
        yield json.dumps(
            {"type": "start", "timestamp": datetime.utcnow().isoformat() + "Z", "total": total}
        ) + "\n"

        for index, e in enumerate(entries, start=1):
            yield json.dumps(
                {
                    "type": "current",
                    "index": index,
                    "total": total,
                    "title": e.title,
                    "url": e.url,
                    "category": e.category,
                    "logo_url": e.logo_url,
                }
            ) + "\n"

            ok, reason = check_live(
                e.url,
                timeout=timeout,
                headers=DEFAULT_HEADERS,
                verify_segment=verify_segment,
            )

            if ok:
                live_count += 1
                e.title = _resolve_title_from_manifest(e, timeout=timeout, headers=DEFAULT_HEADERS)
                live_entries.append(e)
                status = "LIVE"
            else:
                dead_count += 1
                status = "DEAD"

            yield json.dumps(
                {
                    "type": "item",
                    "index": index,
                    "total": total,
                    "title": e.title,
                    "url": e.url,
                    "category": e.category,
                    "logo_url": e.logo_url,
                    "status": status,
                    "reason": reason,
                    "live_count": live_count,
                    "dead_count": dead_count,
                }
            ) + "\n"

            if delay > 0:
                time.sleep(max(delay, 0))

        job_id = _store_job(live_entries)
        yield json.dumps(
            {
                "type": "complete",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "total": total,
                "live_count": live_count,
                "dead_count": dead_count,
                "job_id": job_id,
                "download_url": f"/download/live/{job_id}",
                "curated_download_url": f"/download/curated/{job_id}",
            }
        ) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.post("/merge-playlists")
@app.post("/api/merge-playlists")
def merge_playlists(playlists: List[UploadFile] = File(...)):
    valid_uploads = [u for u in playlists if u and u.filename]
    if not valid_uploads:
        raise HTTPException(status_code=400, detail="Please upload at least one .m3u file.")

    all_entries: List[Entry] = []
    for upload in valid_uploads:
        all_entries.extend(_parse_upload(upload))

    if not all_entries:
        raise HTTPException(status_code=400, detail="No stream entries found in uploaded playlists.")

    unique_entries: List[Entry] = []
    seen_urls = set()
    duplicate_urls_skipped = 0
    for e in all_entries:
        normalized_url = _normalize_url(e.url)
        if not normalized_url:
            continue
        if normalized_url in seen_urls:
            duplicate_urls_skipped += 1
            continue
        seen_urls.add(normalized_url)
        unique_entries.append(Entry(title=e.title, url=e.url, category=e.category, logo_url=e.logo_url))

    used_names = set()
    renamed_count = 0
    for e in unique_entries:
        base = e.title.strip() or "Stream"
        candidate = base
        suffix = 1
        while _normalize_title(candidate) in used_names:
            candidate = f"{base} {suffix}"
            suffix += 1
        if candidate != base:
            renamed_count += 1
        e.title = candidate
        used_names.add(_normalize_title(candidate))

    merge_id = secrets.token_urlsafe(12)
    MERGE_CACHE[merge_id] = _build_entries_m3u_text(unique_entries)
    return {
        "files_uploaded": len(valid_uploads),
        "total_entries": len(all_entries),
        "merged_entries": len(unique_entries),
        "duplicate_urls_skipped": duplicate_urls_skipped,
        "duplicate_names_renamed": renamed_count,
        "download_url": f"/download/merge/{merge_id}",
    }


@app.get("/download/merge/{merge_id}")
def download_merge(merge_id: str):
    payload = MERGE_CACHE.get(merge_id)
    if payload is None:
        return JSONResponse({"error": "Merged download token expired or invalid."}, status_code=404)
    return Response(
        content=payload,
        media_type="audio/x-mpegurl",
        headers={"Content-Disposition": 'attachment; filename="merged_channels.m3u"'},
    )


@app.get("/download/live/{job_id}")
def download_live(job_id: str):
    payload = DOWNLOAD_CACHE.get(job_id)
    if payload is None:
        return JSONResponse({"error": "Download token expired or invalid."}, status_code=404)
    return Response(
        content=payload,
        media_type="audio/x-mpegurl",
        headers={"Content-Disposition": 'attachment; filename="live_only.m3u"'},
    )


@app.post("/api/job/{job_id}/add-channel")
def add_channel(job_id: str, payload: dict):
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")

    name = (payload.get("name") or "").strip()
    category = (payload.get("category") or "").strip()
    logo_url = (payload.get("logo_url") or "").strip()
    stream_url = (payload.get("stream_url") or "").strip()
    if not stream_url:
        raise HTTPException(status_code=400, detail="stream_url is required.")

    live_match = None
    normalized_url = _normalize_url(stream_url)
    for item in job["live_streams"]:
        if _normalize_url(item["url"]) == normalized_url:
            live_match = item
            break
    if live_match is None:
        raise HTTPException(status_code=400, detail="Only LIVE stream URLs can be added.")

    if not name:
        name = (live_match.get("title") or "").strip()
    if not category:
        category = (live_match.get("category") or "").strip()
    if not logo_url:
        logo_url = (live_match.get("logo_url") or "").strip()
    if not name or not category:
        raise HTTPException(status_code=400, detail="name and category are required.")

    normalized_name = _normalize_title(name)
    if normalized_name in job["name_set"]:
        raise HTTPException(status_code=409, detail="Duplicate channel name is not allowed.")
    if normalized_url in job["url_set"]:
        raise HTTPException(status_code=409, detail="Duplicate stream URL is not allowed.")

    channel = {"name": name, "category": category, "logo_url": logo_url, "url": stream_url}
    job["channels"].append(channel)
    job["name_set"].add(normalized_name)
    job["url_set"].add(normalized_url)
    return {"ok": True, "channel": channel, "count": len(job["channels"]), "curated_download_url": f"/download/curated/{job_id}"}


@app.get("/api/job/{job_id}/channels")
def list_channels(job_id: str):
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return {"channels": job["channels"], "count": len(job["channels"])}


@app.delete("/api/job/{job_id}")
def clear_job(job_id: str):
    JOBS.pop(job_id, None)
    DOWNLOAD_CACHE.pop(job_id, None)
    return {"ok": True}


@app.get("/download/curated/{job_id}")
def download_curated(job_id: str):
    job = JOBS.get(job_id)
    if job is None:
        return JSONResponse({"error": "Job not found or expired."}, status_code=404)
    payload = _build_curated_m3u_text(job["channels"])
    return Response(
        content=payload,
        media_type="audio/x-mpegurl",
        headers={"Content-Disposition": 'attachment; filename="curated_live_channels.m3u"'},
    )


@app.post("/api/publish-online")
def publish_online(payload: dict):
    job_id = (payload.get("job_id") or "").strip()
    playlist_slug = (payload.get("playlist_slug") or "").strip()
    playlist_name = (payload.get("playlist_name") or "").strip()
    provider = (payload.get("provider") or "firebase").strip().lower()
    publish_all_live = bool(payload.get("publish_all_live"))
    if not job_id:
        raise HTTPException(status_code=400, detail="job_id is required.")
    if not playlist_slug:
        raise HTTPException(status_code=400, detail="playlist_slug is required.")

    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    channels = job.get("channels") or []
    if not channels and publish_all_live:
        channels = [
            {
                "name": (x.get("title") or "Stream"),
                "category": (x.get("category") or ""),
                "logo_url": (x.get("logo_url") or ""),
                "url": (x.get("url") or ""),
            }
            for x in (job.get("live_streams") or [])
            if (x.get("url") or "").strip()
        ]
    if not channels:
        raise HTTPException(status_code=400, detail="No channels to publish. Save curated channels or enable publish_all_live.")

    try:
        if provider == "supabase":
            result = publish_curated_playlist_supabase(
                playlist_slug=playlist_slug,
                playlist_name=playlist_name or playlist_slug,
                channels=channels,
            )
        else:
            result = publish_curated_playlist(
                playlist_slug=playlist_slug,
                playlist_name=playlist_name or playlist_slug,
                channels=channels,
            )
        return {"ok": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
