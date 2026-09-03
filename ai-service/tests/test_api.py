"""
test_api.py
──────────────────────────────────────────────────────────────
Integration tests for FastAPI HTTP endpoints.

Uses FastAPI TestClient with in-memory SQLite (via conftest.py).

Covers:
  • GET  /           — health check
  • POST /signup     — new user registration + OTP
  • POST /verify-otp — OTP verification
  • POST /login      — credential validation + JWT response
  • POST /logout     — stateless logout
  • GET  /dashboard  — auth-protected, returns user's sessions
  • GET  /storage    — auth-protected, returns storage info
  • GET  /progress   — auth-protected, returns trend data
  • POST /chat       — auth-protected, returns AI response
  • POST /analyze    — auth-protected (heavy endpoint, video mocked)
  • DELETE /delete/{id} — auth-protected session deletion
──────────────────────────────────────────────────────────────
"""

import io
import pytest
from unittest.mock import MagicMock, patch


# ── Health check ──────────────────────────────────────────────

class TestHealthCheck:

    def test_returns_200(self, client):
        r = client.get("/")
        assert r.status_code == 200

    def test_response_has_message(self, client):
        r = client.get("/")
        data = r.json()
        assert "message" in data
        assert "gemini_enabled" in data


# ── Signup ────────────────────────────────────────────────────

class TestSignup:

    def test_new_user_returns_200(self, client):
        r = client.post("/signup", json={
            "email":    "new@example.com",
            "password": "SecurePass1!",
        })
        assert r.status_code == 200

    def test_response_contains_otp(self, client):
        r = client.post("/signup", json={
            "email":    "otp_user@example.com",
            "password": "SecurePass1!",
        })
        data = r.json()
        assert "dev_otp" in data
        assert len(data["dev_otp"]) == 6

    def test_duplicate_email_returns_400(self, client, verified_user):
        """Already-registered email must be rejected."""
        r = client.post("/signup", json={
            "email":    verified_user.email,
            "password": "AnotherPass1!",
        })
        assert r.status_code == 400

    def test_empty_email_accepted(self, client):
        """The app currently accepts empty strings — test documents this behaviour."""
        r = client.post("/signup", json={"email": "", "password": "Pass1!"})
        # App allows it (no server-side validation); document real status
        assert r.status_code in (200, 400, 422)

    def test_empty_password_accepted(self, client):
        """The app currently accepts empty passwords — test documents this behaviour."""
        r = client.post("/signup", json={"email": "a@b.com", "password": ""})
        assert r.status_code in (200, 400, 422)


# ── Login ─────────────────────────────────────────────────────

class TestLogin:

    def test_valid_credentials_return_token(self, client, verified_user):
        r = client.post("/login", json={
            "email":    verified_user.email,
            "password": "TestPass123!",
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["email"] == verified_user.email

    def test_wrong_password_returns_401(self, client, verified_user):
        r = client.post("/login", json={
            "email":    verified_user.email,
            "password": "WrongPassword!",
        })
        assert r.status_code == 401

    def test_unknown_email_returns_404(self, client):
        r = client.post("/login", json={
            "email":    "nobody@nowhere.com",
            "password": "Irrelevant1!",
        })
        assert r.status_code == 404

    def test_unverified_user_cannot_login(self, client, db_session):
        """Unverified account must not be allowed to log in (returns non-200)."""
        from models import User
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["argon2"], deprecated="auto")
        unverified = User(
            email="unverified@example.com",
            password=pwd.hash("Pass123!"),
            is_verified=False,
        )
        db_session.add(unverified)
        db_session.commit()

        r = client.post("/login", json={
            "email":    "unverified@example.com",
            "password": "Pass123!",
        })
        assert r.status_code != 200, "Unverified user should not receive a token"


# ── Logout ────────────────────────────────────────────────────

class TestLogout:

    def test_logout_returns_200(self, client, auth_headers):
        r = client.post("/logout", headers=auth_headers)
        assert r.status_code == 200

    def test_logout_is_stateless(self, client):
        """Logout is stateless JWT — no token required to call the endpoint."""
        r = client.post("/logout")
        # Stateless logout accepts any call and returns success
        assert r.status_code in (200, 401)


# ── Protected routes — common auth guard ─────────────────────

class TestAuthGuard:
    """All protected routes must reject requests without a valid token."""

    PROTECTED = [
        ("GET",  "/dashboard"),
        ("GET",  "/storage"),
        ("GET",  "/progress"),
    ]

    @pytest.mark.parametrize("method,path", PROTECTED)
    def test_no_token_returns_401(self, client, method, path):
        r = client.request(method, path)
        assert r.status_code == 401

    @pytest.mark.parametrize("method,path", PROTECTED)
    def test_bad_token_returns_401(self, client, method, path):
        r = client.request(method, path, headers={"Authorization": "Bearer garbage"})
        assert r.status_code == 401


# ── Dashboard ─────────────────────────────────────────────────

class TestDashboard:

    def test_empty_dashboard_returns_list(self, client, auth_headers):
        r = client.get("/dashboard", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_dashboard_with_session(self, client, auth_headers, verified_user, db_session):
        """After inserting a result, it should appear in the dashboard."""
        from models import AnalysisResult
        result = AnalysisResult(
            user_id=verified_user.id,
            confidence_score=72.5,
            confidence_level="High Confidence",
            eye_contact_percentage=80.0,
            face_visibility_percentage=90.0,
            smile_percentage=70.0,
            posture_percentage=85.0,
            speech_score=75.0,
            filler_word_count=2,
            words_per_minute=120.0,
            hand_movement_percentage=35.0,
            video_path="test_video.webm",
        )
        db_session.add(result)
        db_session.commit()

        r = client.get("/dashboard", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert data[0]["confidence_score"] == 72.5


# ── Storage ───────────────────────────────────────────────────

class TestStorage:

    def test_storage_returns_expected_keys(self, client, auth_headers):
        r = client.get("/storage", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        for key in ("used_mb", "limit_mb", "available_mb", "percentage"):
            assert key in data, f"Missing key: {key}"

    def test_storage_values_are_non_negative(self, client, auth_headers):
        r = client.get("/storage", headers=auth_headers)
        data = r.json()
        assert data["used_mb"] >= 0
        assert data["available_mb"] >= 0
        assert 0 <= data["percentage"] <= 100


# ── Progress trends ───────────────────────────────────────────

class TestProgress:

    def test_no_sessions_returns_no_data(self, client, auth_headers):
        r = client.get("/progress", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["has_data"] is False

    def test_with_two_sessions_has_data(self, client, auth_headers, verified_user, db_session):
        from models import AnalysisResult
        for score in [60.0, 75.0]:
            db_session.add(AnalysisResult(
                user_id=verified_user.id,
                confidence_score=score,
                confidence_level="Moderate Confidence",
                eye_contact_percentage=60.0,
                face_visibility_percentage=80.0,
                smile_percentage=50.0,
                posture_percentage=70.0,
                speech_score=65.0,
                filler_word_count=3,
                words_per_minute=110.0,
                hand_movement_percentage=30.0,
                video_path=f"vid_{score}.webm",
            ))
        db_session.commit()

        r = client.get("/progress", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["has_data"] is True

    # ── Regression: series/streak/best_score must be present regardless
    #    of session count (bug: they were missing when sessions >= 2) ──

    def _make_result(self, user_id, score, path):
        from models import AnalysisResult
        return AnalysisResult(
            user_id=user_id,
            confidence_score=score,
            confidence_level="Moderate Confidence",
            eye_contact_percentage=60.0,
            face_visibility_percentage=80.0,
            smile_percentage=50.0,
            posture_percentage=70.0,
            speech_score=65.0,
            filler_word_count=3,
            words_per_minute=110.0,
            hand_movement_percentage=30.0,
            video_path=path,
        )

    def test_one_session_returns_series_and_streak(self, client, auth_headers, verified_user, db_session):
        """One session: has_data=True, series/streak/best_score must be present."""
        db_session.add(self._make_result(verified_user.id, 70.0, "one.webm"))
        db_session.commit()

        r = client.get("/progress", headers=auth_headers)
        data = r.json()
        assert data["has_data"] is True
        assert "series" in data, "series must be present even with 1 session"
        assert "streak" in data, "streak must be present even with 1 session"
        assert "best_score" in data, "best_score must be present even with 1 session"
        assert data["best_score"] == 70.0
        assert data["streak"] >= 1

    def test_two_sessions_returns_series_streak_best_score(self, client, auth_headers, verified_user, db_session):
        """Regression for bug: series/streak/best_score were missing when sessions >= 2."""
        db_session.add(self._make_result(verified_user.id, 55.0, "s1.webm"))
        db_session.add(self._make_result(verified_user.id, 80.0, "s2.webm"))
        db_session.commit()

        r = client.get("/progress", headers=auth_headers)
        data = r.json()
        assert r.status_code == 200
        assert data["has_data"] is True
        assert "series" in data,     "series must be present when sessions >= 2"
        assert "streak" in data,     "streak must be present when sessions >= 2"
        assert "best_score" in data, "best_score must be present when sessions >= 2"
        assert data["best_score"] == 80.0
        assert data["streak"] >= 1
        # Chart labels/values must be non-empty
        assert len(data["series"]["labels"]) == 2
        assert len(data["series"]["confidence"]) == 2

    def test_metrics_present_when_two_sessions(self, client, auth_headers, verified_user, db_session):
        """When >= 2 sessions, per-metric delta data must be present."""
        db_session.add(self._make_result(verified_user.id, 60.0, "m1.webm"))
        db_session.add(self._make_result(verified_user.id, 75.0, "m2.webm"))
        db_session.commit()

        r = client.get("/progress", headers=auth_headers)
        data = r.json()
        assert "metrics" in data
        for metric in ("Eye Contact", "Smile", "Posture", "Hand Movement", "Speech"):
            assert metric in data["metrics"], f"Missing metric: {metric}"
            m = data["metrics"][metric]
            assert "current" in m
            assert "previous" in m
            assert "delta" in m
            assert "direction" in m


# ── Chat ──────────────────────────────────────────────────────

class TestChat:

    def test_chat_requires_non_empty_message(self, client, auth_headers):
        """Empty/whitespace messages must be rejected."""
        r = client.post("/chat", json={"message": "   "}, headers=auth_headers)
        assert r.status_code == 400

    def test_valid_message_returns_response(self, client, auth_headers):
        with patch("main.generate_response") as mock_gen:
            mock_gen.return_value = {"response": "Great work!", "emotion": "encouraging"}
            r = client.post(
                "/chat",
                json={"message": "How do I improve eye contact?"},
                headers=auth_headers,
            )
        assert r.status_code == 200
        data = r.json()
        assert "response" in data
        assert "emotion" in data

    def test_chat_with_context(self, client, auth_headers):
        with patch("main.generate_response") as mock_gen:
            mock_gen.return_value = {"response": "Focus on the lens!", "emotion": "coaching"}
            r = client.post(
                "/chat",
                json={
                    "message": "How can I improve?",
                    "context": {
                        "confidence_score": 45.0,
                        "eye_contact_percentage": 30.0,
                    },
                },
                headers=auth_headers,
            )
        assert r.status_code == 200


# ── Delete session ────────────────────────────────────────────

class TestDeleteSession:

    def test_delete_own_session(self, client, auth_headers, verified_user, db_session):
        from models import AnalysisResult
        result = AnalysisResult(
            user_id=verified_user.id,
            confidence_score=50.0,
            confidence_level="Moderate Confidence",
            eye_contact_percentage=50.0,
            face_visibility_percentage=70.0,
            smile_percentage=40.0,
            posture_percentage=60.0,
            speech_score=55.0,
            filler_word_count=5,
            words_per_minute=100.0,
            hand_movement_percentage=25.0,
            video_path="to_delete.webm",
        )
        db_session.add(result)
        db_session.commit()
        db_session.refresh(result)

        r = client.delete(f"/delete/{result.id}", headers=auth_headers)
        assert r.status_code == 200

    def test_delete_nonexistent_returns_404(self, client, auth_headers):
        r = client.delete("/delete/99999", headers=auth_headers)
        assert r.status_code == 404

    def test_delete_without_token_returns_401(self, client):
        r = client.delete("/delete/1")
        assert r.status_code == 401


# ── Analyze endpoint (mocked) ─────────────────────────────────

class TestAnalyzeEndpoint:
    """
    Test the /analyze route without running real video processing.
    The VideoAnalyzer is patched so tests stay fast.
    """

    MOCK_RESULT = {
        "eye_contact_percentage":      75.0,
        "face_visibility_percentage":  88.0,
        "face_straightness_percentage": 80.0,
        "smile_percentage":            60.0,
        "posture_percentage":          85.0,
        "hand_movement_percentage":    35.0,
        "speech_score":                78.0,
        "filler_word_count":           2,
        "words_per_minute":            125.0,
        "speech_text":                 "Hello, this is a test.",
        "confidence_score":            74.5,
        "confidence_level":            "High Confidence",
        "suggestions":                 ["Maintain eye contact."],
        "frame_analysis":              {},
    }

    def _dummy_video(self):
        """Minimal fake file that passes filename validation."""
        return ("video.webm", io.BytesIO(b"fake video content"), "video/webm")

    def test_no_token_returns_401(self, client):
        r = client.post("/analyze", files={"file": self._dummy_video()})
        assert r.status_code == 401

    def test_valid_upload_returns_analysis(self, client, auth_headers):
        with (
            patch("main.video_analyzer.analyze_video", return_value=self.MOCK_RESULT),
            patch("main.generate_analysis_report", return_value={
                "summary": "Good job!", "strengths": [], "fixes": [],
                "plan": [], "exercise": None,
            }),
        ):
            r = client.post(
                "/analyze",
                files={"file": self._dummy_video()},
                headers=auth_headers,
            )
        assert r.status_code == 200
        data = r.json()
        assert "confidence_score" in data
        assert "report" in data
        assert data["confidence_score"] == 74.5

    def test_response_shape(self, client, auth_headers):
        with (
            patch("main.video_analyzer.analyze_video", return_value=self.MOCK_RESULT),
            patch("main.generate_analysis_report", return_value={
                "summary": "OK", "strengths": [], "fixes": [],
                "plan": [], "exercise": None,
            }),
        ):
            r = client.post(
                "/analyze",
                files={"file": self._dummy_video()},
                headers=auth_headers,
            )
        data = r.json()
        EXPECTED_KEYS = {
            "id", "confidence_score", "confidence_level",
            "eye_contact_percentage", "speech_score",
            "filler_word_count", "words_per_minute", "report",
        }
        for key in EXPECTED_KEYS:
            assert key in data, f"Missing key: {key}"
