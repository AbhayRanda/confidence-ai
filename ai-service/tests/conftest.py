"""
conftest.py
──────────────────────────────────────────────────────────────
Shared pytest fixtures for Confidence AI test suite.

Key design decision:
  sqlite:///:memory: gives each pool connection its OWN empty DB.
  We use StaticPool so every SQLAlchemy session reuses the SAME
  underlying SQLite connection — tables created via create_all are
  always visible to subsequent sessions in the same test.

  Additionally, after creating the engine we monkeypatch the local
  `SessionLocal` reference in both main.py and auth.py (the two
  modules that call SessionLocal() directly) so the TestClient uses
  the in-memory DB instead of the real confidence.db file.

ML stubs:
  video_analyzer.py has top-level imports of heavy ML packages
  (whisper, cv2, mediapipe, moviepy) that aren't needed for tests.
  We inject lightweight stubs into sys.modules BEFORE any app code
  is imported so that `import main` (which imports VideoAnalyzer)
  never triggers the real ML library load.
──────────────────────────────────────────────────────────────
"""

import sys
import types
from unittest.mock import MagicMock

# ── Stub heavy ML packages before any app import ──────────────
# This must happen at module level so the stubs are in place when
# conftest fixtures do `import main` / `from video_analyzer import …`

def _make_stub(name: str) -> types.ModuleType:
    """Return a MagicMock-based module stub registered in sys.modules."""
    stub = types.ModuleType(name)
    stub.__spec__ = None  # prevents importlib from re-importing
    sys.modules.setdefault(name, stub)
    return stub

# whisper
if "whisper" not in sys.modules:
    _whisper = _make_stub("whisper")
    _whisper.load_model = MagicMock(return_value=MagicMock())

# cv2
if "cv2" not in sys.modules:
    _cv2 = _make_stub("cv2")
    _cv2.CascadeClassifier = MagicMock
    _cv2.cvtColor = MagicMock(return_value=MagicMock())
    _cv2.COLOR_BGR2GRAY = 6
    _cv2.VideoCapture = MagicMock
    _cv2.CAP_PROP_FRAME_COUNT = 7
    _cv2.CAP_PROP_FPS = 5

# moviepy + sub-modules
for _mod in ("moviepy", "moviepy.video", "moviepy.video.io",
             "moviepy.video.io.VideoFileClip"):
    _make_stub(_mod)
_moviepy_main = sys.modules["moviepy"]
_VideoFileClip_mock = MagicMock()
_moviepy_main.VideoFileClip = _VideoFileClip_mock
# Also expose as a direct import: `from moviepy import VideoFileClip`
sys.modules.setdefault("moviepy.VideoFileClip", _make_stub("moviepy.VideoFileClip"))

# mediapipe + sub-modules
for _mod in (
    "mediapipe",
    "mediapipe.python",
    "mediapipe.python.solutions",
    "mediapipe.python.solutions.pose",
    "mediapipe.solutions",
    "mediapipe.solutions.pose",
):
    _make_stub(_mod)
_mp = sys.modules["mediapipe"]
_mp.solutions = sys.modules["mediapipe.solutions"]
_mp.solutions.pose = sys.modules["mediapipe.solutions.pose"]

# ── End ML stubs ───────────────────────────────────────────────

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient


@pytest.fixture()
def db_session(monkeypatch):
    """
    Per-test in-memory SQLite DB with StaticPool.
    All sessions reuse the same connection so create_all tables are
    always visible.  Both main.SessionLocal and auth.SessionLocal are
    monkeypatched to use this engine.
    """
    from database import Base
    import main
    import auth as auth_module

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,          # ← all connections share one SQLite DB
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    monkeypatch.setattr(main, "SessionLocal", TestSession)
    monkeypatch.setattr(auth_module, "SessionLocal", TestSession)

    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session):
    """FastAPI TestClient using the per-test in-memory DB."""
    from main import app
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture()
def verified_user(db_session):
    """Pre-verified user in the per-test DB."""
    from models import User
    from passlib.context import CryptContext

    pwd = CryptContext(schemes=["argon2"], deprecated="auto")
    user = User(
        email="test@example.com",
        password=pwd.hash("TestPass123!"),
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def auth_token(verified_user):
    from auth import create_access_token
    return create_access_token(data={"sub": str(verified_user.id)})


@pytest.fixture()
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
