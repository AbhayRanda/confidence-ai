"""
test_auth.py
──────────────────────────────────────────────────────────────
Unit tests for JWT token creation and get_current_user().

Coverage targets:
  • create_access_token — valid token, custom expiry, sub field
  • get_current_user   — happy path, expired token, bad signature,
                         missing sub, non-existent user
──────────────────────────────────────────────────────────────
"""

from datetime import timedelta

import pytest
from jose import jwt

from auth import create_access_token
from config import get_settings

settings = get_settings()


# ── create_access_token ───────────────────────────────────────

class TestCreateAccessToken:

    def test_returns_string(self):
        token = create_access_token({"sub": "1"})
        assert isinstance(token, str)
        assert len(token) > 20

    def test_payload_contains_sub(self):
        token = create_access_token({"sub": "42"})
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        assert payload["sub"] == "42"

    def test_payload_contains_exp(self):
        token = create_access_token({"sub": "1"})
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        assert "exp" in payload

    def test_custom_expiry(self):
        """Token with 1-second expiry should decode immediately, expire after."""
        from datetime import timezone
        import time
        from jose import JWTError

        token = create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=1))
        # Should decode fine right away
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        assert payload["sub"] == "1"

        # After expiry the token should raise
        time.sleep(2)
        with pytest.raises(JWTError):
            jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
            )

    def test_extra_payload_preserved(self):
        token = create_access_token({"sub": "7", "role": "admin"})
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        assert payload["role"] == "admin"


# ── get_current_user (tested via HTTP endpoints) ─────────────
# get_current_user opens its own DB session internally, so it's
# most reliably tested through the TestClient rather than calling
# it directly. The tests below drive it via protected endpoints.

class TestGetCurrentUser:

    def test_valid_token_grants_access(self, client, auth_headers):
        """Happy path: valid token → 200 on a protected route."""
        r = client.get("/dashboard", headers=auth_headers)
        assert r.status_code == 200

    def test_expired_token_returns_401(self, client):
        """An already-expired token must be rejected."""
        token = create_access_token(
            {"sub": "999"}, expires_delta=timedelta(seconds=-1)
        )
        r = client.get("/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    def test_wrong_signature_returns_401(self, client):
        """Token signed with a different key must be rejected."""
        token = jwt.encode(
            {"sub": "1"},
            "totally-wrong-secret",
            algorithm=settings.jwt_algorithm,
        )
        r = client.get("/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    def test_missing_sub_returns_401(self, client):
        """Token without 'sub' claim must be rejected."""
        token = create_access_token({"data": "no-sub-here"})
        r = client.get("/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    def test_garbage_token_returns_401(self, client):
        r = client.get("/dashboard", headers={"Authorization": "Bearer not.a.jwt"})
        assert r.status_code == 401

    def test_nonexistent_user_returns_401(self, client):
        """Valid token for a user id that doesn't exist → HTTP 401."""
        token = create_access_token({"sub": "99999"})
        r = client.get("/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401
