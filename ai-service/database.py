from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import get_settings

settings = get_settings()

# Create database engine
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Create declarative base for models
Base = declarative_base()