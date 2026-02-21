import os
import re
import secrets
from datetime import datetime, timezone
from typing import Dict, List, Tuple

import requests

from checker import Entry


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


def _supabase_env() -> Tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url:
        raise RuntimeError("SUPABASE_URL is not set.")
    if not service_role:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not set.")
    return url, service_role


def _headers(service_role: str, content_type: str = "application/json") -> Dict[str, str]:
    headers = {
        "apikey": service_role,
        "Authorization": f"Bearer {service_role}",
        "Prefer": "return=representation",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def publish_curated_playlist_supabase(playlist_slug: str, playlist_name: str, channels: List[dict]) -> Dict:
    if not channels:
        raise ValueError("No channels to publish.")

    slug = _sanitize_slug(playlist_slug)
    name = (playlist_name or slug).strip()
    now = datetime.now(timezone.utc).isoformat()

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

    supabase_url, service_role = _supabase_env()

    records = [
        {
            "name": e.title,
            "category": e.category,
            "logo_url": e.logo_url,
            "stream_url": e.url,
            "status": "LIVE",
            "updated_at": now,
        }
        for e in deduped_entries
    ]
    rc = requests.post(
        f"{supabase_url}/rest/v1/channels?on_conflict=stream_url",
        headers=_headers(service_role),
        json=records,
        timeout=20,
    )
    if rc.status_code >= 300:
        raise RuntimeError(f"Supabase channels upsert failed: {rc.status_code} {rc.text[:300]}")
    rows = rc.json() if rc.text else []
    channel_id_by_url = {
        _normalize_url(r.get("stream_url", "")): r.get("id")
        for r in rows
        if isinstance(r, dict)
    }
    missing_urls = [_normalize_url(e.url) for e in deduped_entries if _normalize_url(e.url) not in channel_id_by_url]
    if missing_urls:
        q = ",".join(f"stream_url.eq.{u}" for u in missing_urls[:1000])
        rs_get = requests.get(
            f"{supabase_url}/rest/v1/channels?select=id,stream_url&or=({q})",
            headers=_headers(service_role),
            timeout=20,
        )
        if rs_get.status_code >= 300:
            raise RuntimeError(f"Supabase channel requery failed: {rs_get.status_code} {rs_get.text[:300]}")
        for r in rs_get.json() if rs_get.text else []:
            channel_id_by_url[_normalize_url(r.get("stream_url", ""))] = r.get("id")

    rp = requests.post(
        f"{supabase_url}/rest/v1/playlists?on_conflict=slug",
        headers=_headers(service_role),
        json=[
            {
                "slug": slug,
                "name": name,
                "channel_count": len(deduped_entries),
                "updated_at": now,
                "is_public": True,
            }
        ],
        timeout=20,
    )
    if rp.status_code >= 300:
        raise RuntimeError(f"Supabase playlists upsert failed: {rp.status_code} {rp.text[:300]}")

    rd = requests.delete(
        f"{supabase_url}/rest/v1/playlist_channels?playlist_slug=eq.{slug}",
        headers=_headers(service_role),
        timeout=20,
    )
    if rd.status_code >= 300:
        raise RuntimeError(f"Supabase playlist_channels cleanup failed: {rd.status_code} {rd.text[:300]}")

    links = []
    for idx, e in enumerate(deduped_entries):
        cid = channel_id_by_url.get(_normalize_url(e.url))
        if cid:
            links.append({"playlist_slug": slug, "channel_id": cid, "position": idx})
    if links:
        rl = requests.post(
            f"{supabase_url}/rest/v1/playlist_channels",
            headers=_headers(service_role),
            json=links,
            timeout=20,
        )
        if rl.status_code >= 300:
            raise RuntimeError(f"Supabase playlist_channels insert failed: {rl.status_code} {rl.text[:300]}")

    storage_headers = _headers(service_role, content_type="audio/x-mpegurl")
    storage_headers["x-upsert"] = "true"
    storage_path = f"playlists/{slug}/current.m3u"
    rs = requests.post(
        f"{supabase_url}/storage/v1/object/{storage_path}",
        headers=storage_headers,
        data=m3u_text.encode("utf-8"),
        timeout=20,
    )
    if rs.status_code >= 300:
        raise RuntimeError(f"Supabase storage upload failed: {rs.status_code} {rs.text[:300]}")

    token = secrets.token_urlsafe(24)
    rt = requests.post(
        f"{supabase_url}/rest/v1/playlist_tokens?on_conflict=playlist_slug",
        headers=_headers(service_role),
        json=[{"playlist_slug": slug, "token": token, "is_active": True}],
        timeout=20,
    )
    if rt.status_code >= 300:
        raise RuntimeError(f"Supabase token upsert failed: {rt.status_code} {rt.text[:300]}")
    token_rows = rt.json() if rt.text else []
    active_token = token_rows[0].get("token") if token_rows else token

    public_base = os.environ.get("PUBLIC_PLAYLIST_BASE_URL", "").rstrip("/")
    playlist_url = (
        f"{public_base}/playlist/{active_token}.m3u"
        if public_base
        else f"{supabase_url}/storage/v1/object/public/{storage_path}"
    )

    return {
        "provider": "supabase",
        "slug": slug,
        "name": name,
        "channel_count": len(deduped_entries),
        "duplicate_urls_skipped": skipped_urls,
        "duplicate_names_renamed": renamed_names,
        "storage_path": storage_path,
        "token": active_token,
        "playlist_url": playlist_url,
    }
