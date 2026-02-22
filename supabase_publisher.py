import os
import re
import secrets
from datetime import datetime, timezone
from typing import Dict, List, Tuple
from urllib.parse import quote

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


def _dedupe_entries_with_report(entries: List[Entry]) -> Tuple[List[Entry], List[str], int]:
    unique: List[Entry] = []
    seen_urls = set()
    duplicate_urls: List[str] = []
    for e in entries:
        norm_url = _normalize_url(e.url)
        if not norm_url:
            continue
        if norm_url in seen_urls:
            duplicate_urls.append(norm_url)
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

    return unique, duplicate_urls, renamed


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


def list_playlists_supabase(limit: int = 200) -> List[Dict]:
    supabase_url, service_role = _supabase_env()
    capped = max(1, min(int(limit or 200), 1000))
    rq = requests.get(
        f"{supabase_url}/rest/v1/playlists?select=slug,name,channel_count,updated_at&order=updated_at.desc&limit={capped}",
        headers=_headers(service_role),
        timeout=20,
    )
    if rq.status_code >= 300:
        raise RuntimeError(f"Supabase playlists query failed: {rq.status_code} {rq.text[:300]}")
    rows = rq.json() if rq.text else []
    out: List[Dict] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        out.append(
            {
                "slug": (row.get("slug") or "").strip(),
                "name": (row.get("name") or "").strip(),
                "channel_count": int(row.get("channel_count") or 0),
                "updated_at": row.get("updated_at") or "",
            }
        )
    return out


def _fetch_existing_playlist_entries(supabase_url: str, service_role: str, slug: str) -> List[Entry]:
    rq = requests.get(
        f"{supabase_url}/rest/v1/playlist_channels?select=channel_id,position&playlist_slug=eq.{quote(slug, safe='')}&order=position.asc",
        headers=_headers(service_role),
        timeout=20,
    )
    if rq.status_code >= 300:
        raise RuntimeError(f"Supabase existing playlist query failed: {rq.status_code} {rq.text[:300]}")
    link_rows = rq.json() if rq.text else []
    if not link_rows:
        return []

    channel_ids = [r.get("channel_id") for r in link_rows if r.get("channel_id") is not None]
    if not channel_ids:
        return []

    ids_csv = ",".join(str(cid) for cid in channel_ids)
    rc = requests.get(
        f"{supabase_url}/rest/v1/channels?select=id,name,category,logo_url,stream_url&id=in.({quote(ids_csv, safe=',')})",
        headers=_headers(service_role),
        timeout=20,
    )
    if rc.status_code >= 300:
        raise RuntimeError(f"Supabase existing channels query failed: {rc.status_code} {rc.text[:300]}")
    channel_rows = rc.json() if rc.text else []
    by_id = {row.get("id"): row for row in channel_rows if isinstance(row, dict)}

    ordered_entries: List[Entry] = []
    for link in link_rows:
        row = by_id.get(link.get("channel_id"))
        if not row:
            continue
        stream_url = (row.get("stream_url") or "").strip()
        if not stream_url:
            continue
        ordered_entries.append(
            Entry(
                title=(row.get("name") or "").strip() or "Stream",
                url=stream_url,
                category=(row.get("category") or "").strip(),
                logo_url=(row.get("logo_url") or "").strip(),
            )
        )
    return ordered_entries


def publish_curated_playlist_supabase(
    playlist_slug: str,
    playlist_name: str,
    channels: List[dict],
    merge_with_existing: bool = False,
) -> Dict:
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

    supabase_url, service_role = _supabase_env()

    existing_entries: List[Entry] = []
    if merge_with_existing:
        existing_entries = _fetch_existing_playlist_entries(supabase_url, service_role, slug)

    merged_input = existing_entries + entries if merge_with_existing else entries
    deduped_entries, duplicate_url_list, renamed_names = _dedupe_entries_with_report(merged_input)
    skipped_urls = len(duplicate_url_list)
    m3u_text = _build_entries_m3u_text(deduped_entries)

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
        "merge_with_existing": bool(merge_with_existing),
        "existing_channels_before_merge": len(existing_entries),
        "channel_count": len(deduped_entries),
        "duplicate_urls_skipped": skipped_urls,
        "duplicate_urls": duplicate_url_list,
        "duplicate_names_renamed": renamed_names,
        "storage_path": storage_path,
        "token": active_token,
        "playlist_url": playlist_url,
    }
