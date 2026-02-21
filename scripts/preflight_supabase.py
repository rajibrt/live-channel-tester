import os
import sys
from pathlib import Path

import requests

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from env_loader import load_dotenv_if_exists

# Auto-load project .env
load_dotenv_if_exists(str(ROOT_DIR / ".env"))


def fail(msg: str) -> None:
    print(f"[FAIL] {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"[OK] {msg}")


def main() -> None:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url:
        fail("SUPABASE_URL is not set")
    if not service_role:
        fail("SUPABASE_SERVICE_ROLE_KEY is not set")

    ok("Environment variables found")

    headers = {
        "apikey": service_role,
        "Authorization": f"Bearer {service_role}",
        "Content-Type": "application/json",
    }

    health = requests.get(f"{supabase_url}/rest/v1/", headers=headers, timeout=12)
    if health.status_code >= 400:
        fail(f"Supabase REST endpoint not reachable: {health.status_code}")
    ok("Supabase REST endpoint reachable")

    playlists = requests.get(
        f"{supabase_url}/rest/v1/playlists?select=slug&limit=1",
        headers=headers,
        timeout=12,
    )
    if playlists.status_code >= 400:
        fail(
            "Could not query playlists table. "
            "Run vercel/supabase/schema.sql and verify service role key."
        )
    ok("playlists table query OK")

    channels = requests.get(
        f"{supabase_url}/rest/v1/channels?select=id&limit=1",
        headers=headers,
        timeout=12,
    )
    if channels.status_code >= 400:
        fail(
            "Could not query channels table. "
            "Run vercel/supabase/schema.sql and verify service role key."
        )
    ok("channels table query OK")

    storage = requests.get(
        f"{supabase_url}/storage/v1/bucket",
        headers=headers,
        timeout=12,
    )
    if storage.status_code >= 400:
        fail("Could not list storage buckets. Check service role key permissions.")
    buckets = storage.json() if storage.text else []
    bucket_names = {b.get("name") for b in buckets if isinstance(b, dict)}
    if "playlists" not in bucket_names:
        fail("Storage bucket 'playlists' not found. Create it as public bucket.")
    ok("Storage bucket 'playlists' found")

    print("\nPreflight completed successfully.")


if __name__ == "__main__":
    main()
