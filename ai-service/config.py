from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration from environment variables"""
    
    # Database
    database_url: str = "sqlite:///./confidence.db"
    
    # API
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    api_reload: bool = True
    
    # File Upload
    upload_folder: str = "uploads"
    max_file_size_mb: int = 100
    
    # CORS - comma-separated string
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    # Models
    whisper_model: str = "base"
    face_cascade_path: str = "haarcascade_frontalface_default.xml"
    smile_cascade_path: str = "haarcascade_smile.xml"

    # AI / LLM
    gemini_api_key: str = ""  # Optional — falls back to rule-based engine if empty
    elevenlabs_api_key: str = ""  # Optional — for high-quality TTS
    
    # Analysis Thresholds
    posture_threshold: float = 0.05
    eye_contact_threshold: float = 0.1
    min_eye_contact_percentage: float = 60
    min_face_visibility: float = 70
    min_smile_percentage: float = 40
    min_posture_percentage: float = 60
    min_speech_score: float = 70
    min_hand_movement: float = 20
    max_hand_movement: float = 70
    
    # Logging
    log_level: str = "INFO"
    log_file: str = "logs/app.log"
    
    # Speech Analysis
    filler_words: str = "um,uh,like,basically,actually"
    ideal_words_per_minute_min: int = 100
    ideal_words_per_minute_max: int = 170

    # JWT Authentication
    jwt_secret_key: str = "change-me-in-production"  # Override via .env
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Rate Limiting  (slowapi — per authenticated user)
    rate_limit_analyze: str = "5/hour"    # Video analysis  — heavy endpoint
    rate_limit_chat: str    = "60/minute" # Chat/stream     — lightweight
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
