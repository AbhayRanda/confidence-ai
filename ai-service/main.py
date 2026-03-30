import os
import shutil
import uuid
import random
from datetime import datetime, timedelta
from typing import List
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext

from database import engine, SessionLocal
from models import AnalysisResult, User
from database import Base
from config import get_settings
from logger import logger
from video_analyzer import VideoAnalyzer

# Initialize settings
settings = get_settings()

# Create tables
Base.metadata.create_all(bind=engine)

# Create necessary directories
if not os.path.exists(settings.upload_folder):
    os.makedirs(settings.upload_folder)
    logger.info(f"Created upload folder: {settings.upload_folder}")

if not os.path.exists(os.path.dirname(settings.log_file)):
    os.makedirs(os.path.dirname(settings.log_file), exist_ok=True)

# Initialize FastAPI app
app = FastAPI(
    title="Confidence AI Service",
    description="AI-powered confidence analysis system",
    version="1.0.0"
)

# Mount uploads folder
app.mount("/uploads", StaticFiles(directory=settings.upload_folder), name="uploads")

# Configure CORS with specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.allowed_origins.split(',')],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Password hashing
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Initialize video analyzer
video_analyzer = VideoAnalyzer()

# Storage limit configuration
STORAGE_LIMIT_MB = 500  # 500 MB per user
STORAGE_LIMIT_BYTES = STORAGE_LIMIT_MB * 1024 * 1024


def get_user_storage_usage(user_id: int) -> dict:
    """
    Calculate total storage usage for a user
    Returns: {'used_bytes': int, 'used_mb': float, 'limit_mb': int, 'available_mb': float, 'percentage': float}
    """
    db = SessionLocal()
    try:
        # Get all videos for user
        results = db.query(AnalysisResult).filter(AnalysisResult.user_id == user_id).all()
        
        total_bytes = 0
        for result in results:
            video_path = os.path.join(settings.upload_folder, result.video_path)
            if os.path.exists(video_path):
                total_bytes += os.path.getsize(video_path)
        
        used_mb = total_bytes / (1024 * 1024)
        available_bytes = max(0, STORAGE_LIMIT_BYTES - total_bytes)
        available_mb = available_bytes / (1024 * 1024)
        percentage = (total_bytes / STORAGE_LIMIT_BYTES * 100) if STORAGE_LIMIT_BYTES > 0 else 0
        
        return {
            "used_bytes": total_bytes,
            "used_mb": round(used_mb, 2),
            "limit_mb": STORAGE_LIMIT_MB,
            "available_mb": round(available_mb, 2),
            "percentage": round(percentage, 1)
        }
    finally:
        db.close()


def hash_password(password: str) -> str:
    """Hash a password using argon2"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_current_user(user_id: int = Header(None, alias="X-User-ID")) -> User:
    """
    Get current user from request header
    Expects header: X-User-ID: {user_id}
    """
    if user_id is None:
        raise HTTPException(status_code=401, detail="User ID not provided. Send X-User-ID header.")
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    finally:
        db.close()



# ================= HEALTH CHECK =================

@app.get("/")
def home() -> dict:
    """Health check endpoint"""
    return {"message": "AI Confidence Service Running Successfully"}


# ================= VIDEO ANALYSIS =================

@app.post("/analyze")
async def analyze_video(file: UploadFile = File(...), current_user: User = Depends(get_current_user)) -> dict:
    """
    Analyze a video file for confidence metrics
    
    Args:
        file: Video file to analyze
        current_user: Current authenticated user
        
    Returns:
        Analysis results including confidence score and metrics
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        # Check storage limit before uploading
        storage_info = get_user_storage_usage(current_user.id)
        if storage_info["available_mb"] <= 0:
            raise HTTPException(
                status_code=413,
                detail=f"Storage limit reached (500 MB). Please delete old videos to upload new ones."
            )
        
        logger.info(f"Processing video: {file.filename}")
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(settings.upload_folder, unique_filename)
        
        # Save uploaded video
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"Video saved: {file_path}")
        
        # Analyze video
        analysis_result = video_analyzer.analyze_video(file_path)
        
        # Store in database
        db = SessionLocal()
        try:
            db_result = AnalysisResult(
                user_id=current_user.id,
                confidence_score=analysis_result["confidence_score"],
                confidence_level=analysis_result["confidence_level"],
                eye_contact_percentage=analysis_result["eye_contact_percentage"],
                face_visibility_percentage=analysis_result["face_visibility_percentage"],
                smile_percentage=analysis_result["smile_percentage"],
                posture_percentage=analysis_result["posture_percentage"],
                speech_score=analysis_result["speech_score"],
                filler_word_count=analysis_result["filler_word_count"],
                words_per_minute=analysis_result["words_per_minute"],
                hand_movement_percentage=analysis_result["hand_movement_percentage"],
                video_path=unique_filename
            )
            
            db.add(db_result)
            db.commit()
            db.refresh(db_result)
            logger.info(f"Analysis result stored with ID: {db_result.id}")
            
        finally:
            db.close()
            
        logger.info(f"Analysis result: {analysis_result}")
        # Format response
        return {
            "id": db_result.id,
            "speech_text": analysis_result["speech_text"],
            "eye_contact_percentage": round(analysis_result["eye_contact_percentage"], 2),
            "face_visibility_percentage": round(analysis_result["face_visibility_percentage"], 2),
            "smile_percentage": round(analysis_result["smile_percentage"], 2),
            "posture_percentage": round(analysis_result["posture_percentage"], 2),
            "speech_score": round(analysis_result["speech_score"], 2),
            "filler_word_count": analysis_result["filler_word_count"],
            "words_per_minute": round(analysis_result["words_per_minute"], 2),
            "confidence_score": analysis_result["confidence_score"],
            "hand_movement_percentage": round(analysis_result["hand_movement_percentage"], 2),
            "confidence_level": analysis_result["confidence_level"],
            "suggestions": analysis_result["suggestions"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing video")


# ================= DASHBOARD =================

@app.get("/dashboard")
def get_dashboard(current_user: User = Depends(get_current_user)) -> List[dict]:
    """Get analysis results for current user"""
    db = SessionLocal()
    try:
        results = db.query(AnalysisResult).filter(
            AnalysisResult.user_id == current_user.id
        ).order_by(
            AnalysisResult.created_at.desc()
        ).all()
        
        data = [
            {
                "id": r.id,
                "confidence_score": r.confidence_score,
                "confidence_level": r.confidence_level,
                "eye_contact_percentage": r.eye_contact_percentage,
                "face_visibility_percentage": r.face_visibility_percentage,
                "smile_percentage": r.smile_percentage,
                "posture_percentage": r.posture_percentage,
                "speech_score": r.speech_score,
                "filler_word_count": r.filler_word_count,
                "words_per_minute": r.words_per_minute,
                "hand_movement_percentage": r.hand_movement_percentage,
                "video_path": r.video_path,
                "created_at": r.created_at.isoformat()
            }
            for r in results
        ]
        
        logger.info(f"Dashboard retrieved with {len(data)} results")
        return data
        
    finally:
        db.close()


# ================= STORAGE INFO =================

@app.get("/storage")
def get_storage_info(current_user: User = Depends(get_current_user)) -> dict:
    """Get storage usage information for current user"""
    try:
        storage_info = get_user_storage_usage(current_user.id)
        return {
            "used_mb": storage_info["used_mb"],
            "limit_mb": storage_info["limit_mb"],
            "available_mb": storage_info["available_mb"],
            "percentage": storage_info["percentage"],
            "message": f"You've used {storage_info['used_mb']} MB / {storage_info['limit_mb']} MB" if storage_info["percentage"] < 100 else "Storage limit reached"
        }
    except Exception as e:
        logger.error(f"Error getting storage info: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error getting storage info")


# ================= VIDEO DELETION =================

@app.delete("/delete/{video_id}")
def delete_video(video_id: int, current_user: User = Depends(get_current_user)) -> dict:
    """Delete a video and its analysis result - only if user is owner"""
    db = SessionLocal()
    try:
        result = db.query(AnalysisResult).filter(
            AnalysisResult.id == video_id
        ).first()
        
        if not result:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Verify user ownership
        if result.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this video")
        
        # Delete video file
        if result.video_path and os.path.exists(result.video_path):
            try:
                os.remove(result.video_path)
                logger.info(f"Deleted video file: {result.video_path}")
            except Exception as e:
                logger.warning(f"Failed to delete video file {result.video_path}: {str(e)}")
        
        # Delete from database
        db.delete(result)
        db.commit()
        logger.info(f"Deleted analysis result {video_id}")
        
        return {"message": "Video deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting video {video_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error deleting video")
    finally:
        db.close()


# ================= USER AUTHENTICATION =================

@app.post("/signup")
def signup(email: str, password: str) -> dict:
    """
    Register a new user with email and password
    
    Args:
        email: User email address
        password: User password
        
    Returns:
        Success message with OTP (development mode)
    """
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Generate OTP
        otp = str(random.randint(100000, 999999))
        otp_expiry = datetime.utcnow() + timedelta(minutes=5)
        
        # Create new user
        new_user = User(
            email=email,
            password=hash_password(password),
            otp=otp,
            otp_expiry=otp_expiry,
            is_verified=False
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(f"New user registered: {email}")
        
        # Return OTP in development mode
        return {
            "message": "User created",
            "dev_otp": otp
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error during signup: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error creating user")
    finally:
        db.close()


@app.post("/verify-otp")
def verify_otp(email: str, otp: str) -> dict:
    """
    Verify OTP for email confirmation
    
    Args:
        email: User email address
        otp: One-time password from signup
        
    Returns:
        Success message
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if user.otp != otp:
            raise HTTPException(status_code=400, detail="Invalid OTP")
        
        if datetime.utcnow() > user.otp_expiry:
            raise HTTPException(status_code=400, detail="OTP expired")
        
        # Mark user as verified
        user.is_verified = True
        user.otp = None
        user.otp_expiry = None
        
        db.commit()
        logger.info(f"User verified: {email}")
        
        return {"message": "Email verified successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during OTP verification: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error verifying OTP")
    finally:
        db.close()


@app.post("/login")
def login(email: str, password: str) -> dict:
    """
    Login user with email and password
    
    Args:
        email: User email address
        password: User password
        
    Returns:
        Success message with user email
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if not user.is_verified:
            raise HTTPException(status_code=400, detail="Email not verified")
        
        if not verify_password(password, user.password):
            raise HTTPException(status_code=401, detail="Incorrect password")
        
        logger.info(f"User logged in: {email}")
        
        return {
            "message": "Login successful",
            "email": user.email,
            "user_id": user.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error logging in")
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting server on {settings.api_host}:{settings.api_port}")
    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload
    )