from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import get_settings

settings = get_settings()

db_url = settings.database_url
# Render and other providers often supply postgres://, SQLAlchemy expects postgresql://
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# SQLite requires check_same_thread=False; PostgreSQL does not accept it
connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

# Create database engine
engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Create declarative base for models
Base = declarative_base()
