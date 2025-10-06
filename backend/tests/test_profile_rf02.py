import io

try:
    from PIL import Image

    PIL_OK = True
except Exception:
    PIL_OK = False


def _fake_png():
    if not PIL_OK:
        return io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)
    img = Image.new("RGB", (64, 64))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def test_requires_auth(client):
    r = client.get("/me/profile")
    assert r.status_code in (401, 403)


def test_reject_incomplete(auth_client):
    r = auth_client.put("/me/profile", json={"full_name": "Ada"})
    assert r.status_code == 400
    assert "Faltan campos obligatorios" in r.text


def test_accept_complete(auth_client):
    payload = {
        "full_name": "Ada Lovelace",
        "university": "Uni",
        "degree": "Ing",
        "course": 3,
        "ride_intent": "both",
    }
    r = auth_client.put("/me/profile", json=payload)
    assert r.status_code == 200
    j = r.json()
    assert j["full_name"] == "Ada Lovelace"
    assert j["ride_intent"] == "both"
    assert j["course"] == 3


def test_avatar(auth_client):
    files = {"file": ("a.png", _fake_png(), "image/png")}
    r = auth_client.post("/me/avatar", files=files)
    assert r.status_code == 200
    j = r.json()
    assert isinstance(j["avatar_url"], str) and j["avatar_url"].endswith(
        (".png", ".jpg", ".jpeg")
    )
