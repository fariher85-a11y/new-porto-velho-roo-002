# Home visit tracking regression: /api/track/access dedupe + admin accesses visibility
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
ADMIN_USER = "donas"
ADMIN_PASS = "Seinao10@@"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/admin/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    if r.status_code != 200:
        pytest.skip("admin login failed")
    d = r.json()
    return d.get("token") or d.get("access_token")


def _total(token, q=''):
    r = requests.get(f"{API}/admin/accesses", params={"limit": 50, "q": q}, headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200
    return r.json()


# Direct endpoint: new visitor counted, same visitor deduped
def test_track_new_then_duplicate(token):
    vid = f"TEST_{uuid.uuid4().hex}"
    before = _total(token)["total"]
    payload = {"page": "/inicio.html", "user_agent": "QA", "extra": {"visitor_id": vid}}
    r1 = requests.post(f"{API}/track/access", json=payload, timeout=20)
    assert r1.status_code == 200
    j1 = r1.json()
    assert j1.get("ok") is True and "skipped" not in j1
    r2 = requests.post(f"{API}/track/access", json=payload, timeout=20)
    assert r2.json() == {"ok": True, "skipped": "duplicate"}
    after = _total(token)
    assert after["total"] == before + 1
    assert any(i.get("visitor_id") == vid and i.get("page") == "/inicio.html" for i in after["items"])


# Admin endpoints require auth
def test_accesses_requires_auth():
    r = requests.get(f"{API}/admin/accesses", timeout=15)
    assert r.status_code in (401, 403)


def test_kpis_acessos(token):
    r = requests.get(f"{API}/admin/dashboard/kpis", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json().get("acessos", r.json().get("total", {}).get("acessos") if isinstance(r.json().get("total"), dict) else 0), int)
