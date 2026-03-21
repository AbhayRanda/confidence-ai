from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


# ================= ANALYSIS RESULTS TABLE =================
class AnalysisResult(Base):
    """Store video analysis results"""
    __tablename__ = "analysis_results"

    id: int = Column(Integer, primary_key=True, index=True)
    
    # User Link - IMPORTANT: Each result belongs to a specific user
    user_id: int = Column(Integer, ForeignKey("users.id"), index=True)
    user = relationship("User", back_populates="analysis_results")

    # Confidence Metrics
    confidence_score: float = Column(Float)
    confidence_level: str = Column(String)

    # Video Metrics
    eye_contact_percentage: float = Column(Float)
    face_visibility_percentage: float = Column(Float)
    smile_percentage: float = Column(Float)
    posture_percentage: float = Column(Float)

    # Speech Metrics
    speech_score: float = Column(Float)
    filler_word_count: int = Column(Integer)
    words_per_minute: float = Column(Float)

    # Movement Metrics
    hand_movement_percentage: float = Column(Float)

    # File & Metadata
    video_path: str = Column(String)
    created_at: datetime = Column(DateTime, default=datetime.utcnow)


# ================= USERS TABLE =================
class User(Base):
    """Store user account information"""
    __tablename__ = "users"

    id: int = Column(Integer, primary_key=True, index=True)
    email: str = Column(String, unique=True, index=True)
    password: str = Column(String)

    # OTP Verification
    otp: str = Column(String, nullable=True)
    otp_expiry: datetime = Column(DateTime, nullable=True)
    is_verified: bool = Column(Boolean, default=False)

    # Metadata
    created_at: datetime = Column(DateTime, default=datetime.utcnow)
    
    # Relationship: One user has many analysis results
    analysis_results = relationship("AnalysisResult", back_populates="user", cascade="all, delete-orphan")