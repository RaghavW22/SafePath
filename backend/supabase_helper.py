"""
Supabase helper — thin wrapper around the Supabase PostgREST API using httpx.
Replaces firebase_helper.py.
"""
import os
from pathlib import Path
import httpx
from dotenv import load_dotenv

# Explicitly find .env relative to this file (handles Flask debug reloader)
_env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(_env_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Debug: verify key is loaded
if not SUPABASE_KEY:
    print(f"WARNING: SUPABASE_SERVICE_ROLE_KEY is empty! Looked for .env at: {_env_path}")
else:
    print(f"Supabase key loaded OK (length={len(SUPABASE_KEY)})")

_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

REST = f"{SUPABASE_URL}/rest/v1"

# ─── Generic helpers ───────────────────────────────────────────────────────────

def _url(table: str) -> str:
    return f"{REST}/{table}"


# Persistent HTTP client for connection pooling and speed
client = httpx.Client(headers=_HEADERS, timeout=10.0)

def _check(r: httpx.Response) -> httpx.Response:
    """Raise with the actual Supabase error body for easier debugging."""
    if r.status_code >= 400:
        print(f"[SUPABASE ERROR] {r.status_code} {r.request.method} {r.request.url}")
        print(f"  Response: {r.text}")
        r.raise_for_status()
    return r


def select(table: str, params: dict | None = None) -> list[dict]:
    """SELECT rows.  `params` are PostgREST query params, e.g. {"status": "eq.active"}."""
    r = client.get(_url(table), params=params or {})
    _check(r)
    return r.json()


def select_one(table: str, params: dict) -> dict | None:
    rows = select(table, {**params, "limit": 1})
    return rows[0] if rows else None


def insert(table: str, data: dict | list) -> list[dict]:
    """INSERT one or more rows."""
    r = client.post(_url(table), json=data)
    _check(r)
    return r.json()


def upsert(table: str, data: dict | list) -> list[dict]:
    """UPSERT (insert or update on conflict)."""
    r = client.post(_url(table), headers={"Prefer": "return=representation,resolution=merge-duplicates"}, json=data)
    _check(r)
    return r.json()


def update(table: str, params: dict, data: dict) -> list[dict]:
    """UPDATE rows matching `params`."""
    r = client.patch(_url(table), params=params, json=data)
    _check(r)
    return r.json()


def delete(table: str, params: dict) -> list[dict]:
    """DELETE rows matching `params`."""
    r = client.delete(_url(table), params=params)
    _check(r)
    return r.json()


# ─── Bootstrap ─────────────────────────────────────────────────────────────────

def init_db():
    """Verify Supabase connectivity and bootstrap rooms + admin if needed."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("CRITICAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env")
        print(f"  Looked for .env at: {_env_path}")
        return

    try:
        rooms = select("rooms", {"limit": 1})
        if not rooms:
            print("Bootstrapping rooms in Supabase...")
            rows = []
            for f in range(1, 4):
                for r in range(1, 11):
                    r_num = f * 100 + r
                    rows.append({"room_number": r_num, "floor": f, "status": "available"})
            upsert("rooms", rows)

        admin = select_one("staff", {"staff_id": "eq.admin"})
        if not admin:
            insert("staff", {"staff_id": "admin", "name": "Admin", "pin": "admin123", "role": "admin"})

        print("Supabase initialization complete.")
    except Exception as e:
        print(f"Supabase bootstrap error: {e}")
        print("  → Did you run supabase_setup.sql in the Supabase SQL Editor?")
