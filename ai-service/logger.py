import logging
import os
from config import get_settings

settings = get_settings()


def setup_logging() -> logging.Logger:
    """Configure logging for the application"""
    
    # Create logs directory if it doesn't exist
    log_dir = os.path.dirname(settings.log_file)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # Configure logging
    logger = logging.getLogger("confidence_ai")
    logger.setLevel(getattr(logging, settings.log_level))
    
    # File handler
    file_handler = logging.FileHandler(settings.log_file)
    file_handler.setLevel(getattr(logging, settings.log_level))
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, settings.log_level))
    
    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    # Add handlers
    if not logger.handlers:
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
    
    return logger


logger = setup_logging()
