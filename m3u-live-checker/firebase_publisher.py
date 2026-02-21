import hashlib
import json
import os
import re
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from checker import Entry

_FIREBASE_APP = None


def _sanitize_slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9-]+", "-", (value or "").strip().lower())
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    if not slug:
        raise ValueError("playlist_slug is required")
    return slug


def _normalize_name(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def _normalize_url(value: str) -> str:
    return (value or "").strip()


def _sanitize_attr(value: str) -> str:
    return (value or "").replace('"', "'").strip()


def _build_entries_m3u_text(entries: List[Entry]) -> str:
    sorted_entries = sorted(
        entries,
        key=lambda e: (
            (e.category or "").strip().lower(),
            (e.title or "").strip().lower(),
            (e.url or "").strip().lower(),
        ),
    )
    lines = ["#EXTM3U", ""]
    for e in sorted_entries:
        safe_title = _sanitize_attr(e.title or "Stream")
        attrs = [f'tvg-name="{safe_title}"']
        if e.category:
            attrs.append(f'group-title="{_sanitize_attr(e.category)}"')
        if e.logo_url:
            attrs.append(f'tvg-logo="{_sanitize_attr(e.logo_url)}"')
        lines.append(f"#EXTINF:-1 {' '.join(attrs)},{safe_title}")
        lines.append(e.url)
    return "\n".join(lines) + "\n"


def _dedupe_entries(entries: List[Entry]) -> Tuple[List[Entry], int, int]:
    unique: List[Entry] = []
    seen_urls = set()
    url_dupes = 0
    for e in entries:
        norm_url = _normalize_url(e.url)
        if not norm_url:
            continue
        if norm_url in seen_urls:
            url_dupes += 1
            continue
        seen_urls.add(norm_url)
        unique.append(Entry(title=e.title, url=e.url, category=e.category, logo_url=e.logo_url))

    used_names = set()
    renamed = 0
    for e in unique:
        base = (e.title or "Stream").strip() or "Stream"
        candidate = base
        suffix = 1
        while _normalize_name(candidate) in used_names:
            candidate = f"{base} {suffix}"
            suffix += 1
        if candidate != base:
            renamed += 1
        e.title = candidate
        used_names.add(_normalize_name(candidate))
    return unique, url_dupes, renamed


def _get_firebase_clients():
    global _FIREBASE_APP
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore, storage
    except Exception as exc:
        raise RuntimeError("firebase-admin is not installed in this environment.") from exc

    service_account = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    storage_bucket = os.environ.get("FIREBASE_STORAGE_BUCKET", "").strip()
    if not service_account:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is not set.")
    if not storage_bucket:
        raise RuntimeError("FIREBASE_STORAGE_BUCKET is not set.")

    if _FIREBASE_APP is None:
        if os.path.exists(service_account):
            cred = credentials.Certificate(service_account)
        else:
            info = json.loads(service_account)
            cred = credentials.Certificate(info)
        _FIREBASE_APP = firebase_admin.initialize_app(
            cred,
            {"storageBucket": storage_bucket},
        )

    return firestore.client(_FIREBASE_APP), storage.bucket(app=_FIREBASE_APP)


def publish_curated_playlist(playlist_slug: str, playlist_name: str, channels: List[dict]) -> Dict:
    if not channels:
        raise ValueError("No channels to publish.")

    slug = _sanitize_slug(playlist_slug)
    name = (playlist_name or slug).strip()
    now = datetime.now(timezone.utc)

    entries = [
        Entry(
            title=(c.get("name") or "").strip() or "Stream",
            url=(c.get("url") or "").strip(),
            category=(c.get("category") or "").strip(),
            logo_url=(c.get("logo_url") or "").strip(),
        )
        for c in channels
    ]

    deduped_entries, skipped_urls, renamed_names = _dedupe_entries(entries)
    m3u_text = _build_entries_m3u_text(deduped_entries)

    db, bucket = _get_firebase_clients()
    channel_ids: List[str] = []

    for e in deduped_entries:
        url_norm = _normalize_url(e.url)
        channel_id = hashlib.sha1(url_norm.encode("utf-8")).hexdigest()[:24]
        db.collection("channels").document(channel_id).set(
            {
                "name": e.title,
                "category": e.category,
                "logoUrl": e.logo_url,
                "streamUrl": e.url,
                "status": "LIVE",
                "updatedAt": now,
                "source": "local-agent-admin",
            },
            merge=True,
        )
        channel_ids.append(channel_id)

    storage_path = f"playlists/{slug}/current.m3u"
    blob = bucket.blob(storage_path)
    blob.upload_from_string(m3u_text, content_type="audio/x-mpegurl")
    blob.cache_control = "public, max-age=60"
    blob.patch()

    db.collection("playlists").document(slug).set(
        {
            "slug": slug,
            "name": name,
            "channelIds": channel_ids,
            "channelCount": len(channel_ids),
            "updatedAt": now,
            "isPublic": True,
            "storagePath": storage_path,
        },
        merge=True,
    )

    db.collection("playlists_public").document(slug).set(
        {
            "slug": slug,
            "name": name,
            "storagePath": storage_path,
            "updatedAt": now,
        },
        merge=True,
    )

    public_base = os.environ.get("FIREBASE_PLAYLIST_BASE_URL", "").rstrip("/")
    playlist_url = f"{public_base}/playlist/{slug}.m3u" if public_base else f"gs://{bucket.name}/{storage_path}"

    return {
        "slug": slug,
        "name": name,
        "channel_count": len(channel_ids),
        "duplicate_urls_skipped": skipped_urls,
        "duplicate_names_renamed": renamed_names,
        "storage_path": storage_path,
        "playlist_url": playlist_url,
    }
