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

from flask import Flask, Response, jsonify, render_template, request, send_file, stream_with_context

from checker import Entry, check_live, fetch_text, parse_m3u
from env_loader import load_dotenv_if_exists
from supabase_publisher import list_playlists_supabase, publish_curated_playlist_supabase

app = Flask(__name__)
load_dotenv_if_exists()

DEFAULT_TIMEOUT = 10.0
DEFAULT_DELAY = 0.2
DEFAULT_MAX = 0
DEFAULT_VERIFY_SEGMENT = True

# In-memory cache for generated live playlists.
DOWNLOAD_CACHE: Dict[str, str] = {}
JOBS: Dict[str, dict] = {}
MERGE_CACHE: Dict[str, str] = {}

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "*/*",
}


def _is_http_url(value: str) -> bool:
    return bool(re.match(r"^https?://", (value or "").strip(), re.IGNORECASE))


def _parse_m3u_text(text: str) -> List[Entry]:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".m3u", mode="w", encoding="utf-8") as tmp:
        temp_path = Path(tmp.name)
        tmp.write(text)
    entries = parse_m3u(str(temp_path))
    temp_path.unlink(missing_ok=True)
    return entries


def _parse_m3u_upload(upload) -> List[Entry]:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".m3u") as tmp:
        temp_path = Path(tmp.name)
        tmp.write(upload.read())
    entries = parse_m3u(str(temp_path))
    temp_path.unlink(missing_ok=True)
    return entries


def _load_playlist_entries(timeout: float) -> List[Entry]:
    upload = request.files.get("playlist")
    playlist_url = (request.form.get("playlist_url") or "").strip()

    if upload is not None and upload.filename:
        return _parse_m3u_upload(upload)

    if not playlist_url:
        raise ValueError("Please upload an .m3u/.m3u8 file or provide playlist_url.")
    if not _is_http_url(playlist_url):
        raise ValueError("playlist_url must start with http:// or https://")

    status, text, _ = fetch_text(playlist_url, timeout=timeout, headers=DEFAULT_HEADERS)
    if status != 200:
        raise ValueError(f"Failed to fetch playlist_url. HTTP {status}")
    if not text.strip():
        raise ValueError("Playlist content is empty.")

    return _parse_m3u_text(text)


def build_live_m3u_text(entries: List[Entry]) -> str:
    buffer = io.StringIO()
    buffer.write("#EXTM3U\n\n")
    for e in entries:
        buffer.write(f"#EXTINF:-1,{e.title}\n")
        buffer.write(f"{e.url}\n")
    return buffer.getvalue()


def build_entries_m3u_text(entries: List[Entry]) -> str:
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


def _sanitize_attr(value: str) -> str:
    return value.replace('"', "'").strip()


def build_curated_m3u_text(channels: List[dict]) -> str:
    buffer = io.StringIO()
    buffer.write("#EXTM3U\n\n")
    sorted_channels = sorted(
        channels,
        key=lambda c: (
            (c.get("category") or "").strip().lower(),
            (c.get("name") or "").strip().lower(),
            (c.get("url") or "").strip().lower(),
        ),
    )
    for c in sorted_channels:
        name = _sanitize_attr(c["name"])
        category = _sanitize_attr(c.get("category", ""))
        logo_url = _sanitize_attr(c.get("logo_url", ""))
        extinf = (
            f'#EXTINF:-1 tvg-name="{name}" group-title="{category}" '
            f'tvg-logo="{logo_url}",{name}'
        )
        buffer.write(extinf + "\n")
        buffer.write(c["url"].strip() + "\n")
    return buffer.getvalue()


def _normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


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


def _store_job(live_entries: List[Entry]) -> str:
    job_id = secrets.token_urlsafe(12)
    JOBS[job_id] = {
        "live_streams": [
            {
                "title": e.title,
                "url": e.url,
                "category": e.category,
                "logo_url": e.logo_url,
            }
            for e in live_entries
        ],
        "live_url_set": {_normalize_url(e.url) for e in live_entries},
        "channels": [],
        "name_set": set(),
        "url_set": set(),
    }
    return job_id


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/test")
def api_test():
    timeout = float(request.form.get("timeout", DEFAULT_TIMEOUT))
    delay = max(0.0, float(request.form.get("delay", DEFAULT_DELAY)))
    max_items = int(request.form.get("max_items", DEFAULT_MAX))
    verify_segment = request.form.get("verify_segment", "true").lower() == "true"

    try:
        entries = _load_playlist_entries(timeout=timeout)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if max_items > 0:
        entries = entries[:max_items]

    if not entries:
        return jsonify({"error": "No stream entries found in playlist."}), 400

    live: List[Entry] = []
    dead: List[Entry] = []
    dead_rows: List[dict] = []
    report_rows: List[dict] = []

    for e in entries:
        ok, reason = check_live(
            e.url,
            timeout=timeout,
            headers=DEFAULT_HEADERS,
            verify_segment=verify_segment,
        )
        if ok:
            e.title = _resolve_title_from_manifest(e, timeout=timeout, headers=DEFAULT_HEADERS)
            live.append(e)
            report_rows.append({"title": e.title, "url": e.url, "status": "LIVE", "reason": reason})
        else:
            dead.append(e)
            report_rows.append({"title": e.title, "url": e.url, "status": "DEAD", "reason": reason})
            dead_rows.append({"title": e.title, "url": e.url, "reason": reason})

        if delay > 0:
            time.sleep(delay)

    job_id = _store_job(live)
    DOWNLOAD_CACHE[job_id] = build_live_m3u_text(live)

    return jsonify(
        {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "total": len(entries),
            "live_count": len(live),
            "dead_count": len(dead),
            "job_id": job_id,
            "live": [
                {
                    "title": e.title,
                    "url": e.url,
                    "category": e.category,
                    "logo_url": e.logo_url,
                }
                for e in live
            ],
            "dead": dead_rows,
            "download_url": f"/download/live/{job_id}",
            "curated_download_url": f"/download/curated/{job_id}",
        }
    )


@app.post("/api/test-stream")
def api_test_stream():
    timeout = float(request.form.get("timeout", DEFAULT_TIMEOUT))
    delay = max(0.0, float(request.form.get("delay", DEFAULT_DELAY)))
    max_items = int(request.form.get("max_items", DEFAULT_MAX))
    verify_segment = request.form.get("verify_segment", "true").lower() == "true"

    try:
        entries = _load_playlist_entries(timeout=timeout)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if max_items > 0:
        entries = entries[:max_items]

    if not entries:
        return jsonify({"error": "No stream entries found in playlist."}), 400

    def generate():
        live: List[Entry] = []
        dead_count = 0
        total = len(entries)

        yield json.dumps(
            {
                "type": "start",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "total": total,
            }
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
                e.title = _resolve_title_from_manifest(e, timeout=timeout, headers=DEFAULT_HEADERS)
                live.append(e)
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
                    "live_count": len(live),
                    "dead_count": dead_count,
                }
            ) + "\n"

            if delay > 0:
                time.sleep(delay)

        job_id = _store_job(live)
        DOWNLOAD_CACHE[job_id] = build_live_m3u_text(live)

        yield json.dumps(
            {
                "type": "complete",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "total": total,
                "live_count": len(live),
                "dead_count": dead_count,
                "job_id": job_id,
                "download_url": f"/download/live/{job_id}",
                "curated_download_url": f"/download/curated/{job_id}",
            }
        ) + "\n"

    return Response(
        stream_with_context(generate()),
        mimetype="application/x-ndjson",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/download/live/<job_id>")
def download_live(job_id: str):
    payload = DOWNLOAD_CACHE.get(job_id)
    if payload is None:
        return jsonify({"error": "Download token expired or invalid."}), 404

    return send_file(
        io.BytesIO(payload.encode("utf-8")),
        mimetype="audio/x-mpegurl",
        as_attachment=True,
        download_name="live_only.m3u",
    )


@app.post("/api/job/<job_id>/add-channel")
def add_channel(job_id: str):
    job = JOBS.get(job_id)
    if job is None:
        return jsonify({"error": "Job not found or expired."}), 404

    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    category = (payload.get("category") or "").strip()
    logo_url = (payload.get("logo_url") or "").strip()
    stream_url = (payload.get("stream_url") or "").strip()

    if not stream_url:
        return jsonify({"error": "stream_url is required."}), 400

    live_match = None
    normalized_url = _normalize_url(stream_url)
    for item in job["live_streams"]:
        if _normalize_url(item["url"]) == normalized_url:
            live_match = item
            break

    if live_match is None:
        return jsonify({"error": "Only LIVE stream URLs can be added."}), 400

    if not name:
        name = (live_match.get("title") or "").strip()
    if not category:
        category = (live_match.get("category") or "").strip()
    if not logo_url:
        logo_url = (live_match.get("logo_url") or "").strip()

    if not name or not category:
        return jsonify({"error": "name and category are required."}), 400

    normalized_name = _normalize_name(name)

    if normalized_name in job["name_set"]:
        return jsonify({"error": "Duplicate channel name is not allowed."}), 409
    if normalized_url in job["url_set"]:
        return jsonify({"error": "Duplicate stream URL is not allowed."}), 409

    channel = {
        "name": name,
        "category": category,
        "logo_url": logo_url,
        "url": stream_url,
    }

    job["channels"].append(channel)
    job["name_set"].add(normalized_name)
    job["url_set"].add(normalized_url)

    return jsonify(
        {
            "ok": True,
            "channel": channel,
            "count": len(job["channels"]),
            "curated_download_url": f"/download/curated/{job_id}",
        }
    )


@app.get("/api/job/<job_id>/channels")
def list_channels(job_id: str):
    job = JOBS.get(job_id)
    if job is None:
        return jsonify({"error": "Job not found or expired."}), 404
    return jsonify({"channels": job["channels"], "count": len(job["channels"])})


@app.post("/api/publish-online")
def publish_online():
    payload = request.get_json(silent=True) or {}
    job_id = (payload.get("job_id") or "").strip()
    playlist_slug = (payload.get("playlist_slug") or "").strip()
    playlist_name = (payload.get("playlist_name") or "").strip()
    provider = (payload.get("provider") or "supabase").strip().lower()
    publish_all_live = bool(payload.get("publish_all_live"))
    merge_with_existing = bool(payload.get("merge_with_existing", False))
    fallback_channels = payload.get("channels") or []

    if not playlist_slug:
        return jsonify({"error": "playlist_slug is required."}), 400

    channels = []
    if job_id:
        job = JOBS.get(job_id)
        if job is None:
            return jsonify({"error": "Job not found or expired."}), 404
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
    else:
        if isinstance(fallback_channels, list):
            channels = [
                {
                    "name": (x.get("name") or x.get("title") or "Stream"),
                    "category": (x.get("category") or ""),
                    "logo_url": (x.get("logo_url") or ""),
                    "url": (x.get("url") or ""),
                }
                for x in fallback_channels
                if isinstance(x, dict) and (x.get("url") or "").strip()
            ]
    if not channels:
        return jsonify({"error": "No channels to publish. Run test first (or stop after some progress) and keep LIVE/curated data."}), 400

    try:
        if provider != "supabase":
            return jsonify({"error": "Unsupported provider. Use supabase."}), 400

        result = publish_curated_playlist_supabase(
            playlist_slug=playlist_slug,
            playlist_name=playlist_name or playlist_slug,
            channels=channels,
            merge_with_existing=merge_with_existing,
        )
        return jsonify({"ok": True, "result": result})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.get("/api/playlists-existing")
def api_playlists_existing():
    try:
        items = list_playlists_supabase(limit=300)
        return jsonify({"items": items, "count": len(items)})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.delete("/api/job/<job_id>")
def clear_job(job_id: str):
    JOBS.pop(job_id, None)
    DOWNLOAD_CACHE.pop(job_id, None)
    return jsonify({"ok": True})


@app.post("/api/merge-playlists")
def merge_playlists():
    uploads = request.files.getlist("playlists")
    valid_uploads = [u for u in uploads if u and u.filename]
    if not valid_uploads:
        return jsonify({"error": "Please upload at least one .m3u file."}), 400

    all_entries: List[Entry] = []
    for upload in valid_uploads:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".m3u") as tmp:
            temp_path = Path(tmp.name)
            tmp.write(upload.read())
        parsed = parse_m3u(str(temp_path))
        temp_path.unlink(missing_ok=True)
        all_entries.extend(parsed)

    if not all_entries:
        return jsonify({"error": "No stream entries found in uploaded playlists."}), 400

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
        unique_entries.append(
            Entry(
                title=e.title or "Stream",
                url=e.url,
                category=e.category,
                logo_url=e.logo_url,
            )
        )

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
    MERGE_CACHE[merge_id] = build_entries_m3u_text(unique_entries)

    return jsonify(
        {
            "files_uploaded": len(valid_uploads),
            "total_entries": len(all_entries),
            "merged_entries": len(unique_entries),
            "duplicate_urls_skipped": duplicate_urls_skipped,
            "duplicate_names_renamed": renamed_count,
            "download_url": f"/download/merge/{merge_id}",
        }
    )


@app.get("/download/curated/<job_id>")
def download_curated(job_id: str):
    job = JOBS.get(job_id)
    if job is None:
        return jsonify({"error": "Job not found or expired."}), 404

    payload = build_curated_m3u_text(job["channels"])
    return send_file(
        io.BytesIO(payload.encode("utf-8")),
        mimetype="audio/x-mpegurl",
        as_attachment=True,
        download_name="curated_live_channels.m3u",
    )


@app.get("/download/merge/<merge_id>")
def download_merge(merge_id: str):
    payload = MERGE_CACHE.get(merge_id)
    if payload is None:
        return jsonify({"error": "Merged download token expired or invalid."}), 404

    return send_file(
        io.BytesIO(payload.encode("utf-8")),
        mimetype="audio/x-mpegurl",
        as_attachment=True,
        download_name="merged_channels.m3u",
    )


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
