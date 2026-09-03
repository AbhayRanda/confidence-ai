"""
auth.py
──────────────────────────────────────────────────────────────
JWT Authentication utilities for Confidence AI.

Provides:
  • create_access_token()   — sign a new JWT for a user
  • get_current_user()      — FastAPI Depends() that decodes the Bearer
                              token and returns the authenticated User row
  • oauth2_scheme           — FastAPI OAuth2PasswordBearer for Swagger UI
──────────────────────────────────────────────────────────────
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from config import get_settings
from database import SessionLocal
from models import User
from logger import logger

settings = get_settings()

# FastAPI security scheme — tells Swagger UI where to get a token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


# ── Token creation ────────────────────────────────────────────

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.

    Args:
        data:          Payload dict (must include "sub" = user id as str).
        expires_delta: Optional custom lifetime; defaults to settings value.

    Returns:
        Encoded JWT string.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode["exp"] = expire
    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


# ── Token verification / current-user dependency ─────────────

def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    FastAPI dependency — decode Bearer JWT and return the User row.

    Raises:
        401 Unauthorized if the token is missing, invalid, or expired.
        401 Unauthorized if the user referenced by the token no longer exists.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id_str: Optional[str] = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        logger.warning("JWT decode failed — invalid or expired token")
        raise credentials_exception

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            logger.warning(f"JWT references non-existent user id={user_id}")
            raise credentials_exception
        return user
    finally:
        db.close()
