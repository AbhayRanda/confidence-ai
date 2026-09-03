from datetime import datetime
from typing import List, Optional
from sqlalchemy import Integer, Float, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


# ================= ANALYSIS RESULTS TABLE =================
class AnalysisResult(Base):
    """Store video analysis results"""
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    # User Link - IMPORTANT: Each result belongs to a specific user
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    user: Mapped[Optional["User"]] = relationship("User", back_populates="analysis_results")

    # Confidence Metrics
    confidence_score: Mapped[float] = mapped_column(Float)
    confidence_level: Mapped[str] = mapped_column(String)

    # Video Metrics
    eye_contact_percentage: Mapped[float] = mapped_column(Float)
    face_visibility_percentage: Mapped[float] = mapped_column(Float)
    smile_percentage: Mapped[float] = mapped_column(Float)
    posture_percentage: Mapped[float] = mapped_column(Float)

    # Speech Metrics
    speech_score: Mapped[float] = mapped_column(Float)
    filler_word_count: Mapped[int] = mapped_column(Integer)
    words_per_minute: Mapped[float] = mapped_column(Float)

    # Movement Metrics
    hand_movement_percentage: Mapped[float] = mapped_column(Float)

    # File & Metadata
    video_path: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ================= USERS TABLE =================
class User(Base):
    """Store user account information"""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password: Mapped[str] = mapped_column(String)

    # OTP Verification
    otp: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    otp_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationship: One user has many analysis results
    analysis_results: Mapped[List["AnalysisResult"]] = relationship("AnalysisResult", back_populates="user", cascade="all, delete-orphan")