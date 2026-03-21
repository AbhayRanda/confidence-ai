# Confidence AI - Backend Service

AI-powered confidence analysis system using video analysis and speech recognition.

## Features

- **Video Analysis**
  - Face detection and visibility tracking
  - Smile detection
  - Posture analysis
  - Eye contact detection
  - Hand movement tracking

- **Speech Analysis**
  - Filler word detection
  - Words per minute calculation
  - Speech quality scoring

- **User Management**
  - Email-based registration
  - OTP verification
  - Secure password hashing

- **Analysis Results**
  - Comprehensive confidence scoring
  - Personalized improvement suggestions
  - Historical analytics

## Setup

### Prerequisites

- Python 3.8+
- pip (Python package manager)

### Installation

1. **Clone the repository**
   ```bash
   cd ai-service
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment**
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

6. **Run the server**
   ```bash
   python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

   Or use the startup script (Windows):
   ```bash
   start.bat
   ```

The server will be available at `http://127.0.0.1:8000`

## API Endpoints

### Health Check
- **GET** `/` - Check if service is running

### Video Analysis
- **POST** `/analyze` - Analyze a video file
  - Request: `multipart/form-data` with video file
  - Response: Analysis results with confidence score and metrics

- **GET** `/dashboard` - Get all analysis results
  - Response: Array of analysis records

- **DELETE** `/delete/{video_id}` - Delete a video and its analysis
  - Response: Success message

### User Authentication
- **POST** `/signup` - Register a new user
  - Params: `email`, `password`
  - Response: Success message with OTP (dev mode)

- **POST** `/verify-otp` - Verify email with OTP
  - Params: `email`, `otp`
  - Response: Success message

- **POST** `/login` - Login user
  - Params: `email`, `password`
  - Response: Success message with email

## Configuration

All configuration is managed via environment variables in `.env` file:

### Database
- `DATABASE_URL`: SQLite database path

### API
- `API_HOST`: Server host (default: 127.0.0.1)
- `API_PORT`: Server port (default: 8000)

### File Upload
- `UPLOAD_FOLDER`: Directory for uploaded videos
- `MAX_FILE_SIZE_MB`: Maximum file size in MB

### CORS
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins

### Analysis
- `WHISPER_MODEL`: Speech recognition model (base, small, medium, large)
- `POSTURE_THRESHOLD`: Threshold for posture detection
- `EYE_CONTACT_THRESHOLD`: Threshold for eye contact detection
- Various thresholds for confidence score calculation

### Logging
- `LOG_LEVEL`: Logging level (INFO, DEBUG, WARNING, ERROR)
- `LOG_FILE`: Path to log file

## Project Structure

```
ai-service/
├── main.py              # FastAPI application and endpoints
├── config.py            # Configuration management
├── database.py          # Database setup
├── models.py            # SQLAlchemy models
├── logger.py            # Logging configuration
├── video_analyzer.py    # Video analysis logic
├── requirements.txt     # Python dependencies
├── .env.example         # Example environment variables
├── .env                 # Environment variables (local)
├── .gitignore           # Git ignore rules
├── start.bat            # Windows startup script
└── README.md            # This file
```

## Logging

Logs are stored in `logs/app.log` and also output to console. Check logs for debugging and monitoring.

## Error Handling

The API returns appropriate HTTP status codes:
- `200` - Success
- `400` - Bad request
- `404` - Not found
- `500` - Server error

All errors include descriptive messages in the response.

## Performance Tips

1. **Optimize Whisper Model**: Use `base` or `small` for faster processing, `large` for better accuracy
2. **File Size**: Keep video files under 1GB for optimal processing time
3. **Caching**: Analysis results are cached immediately in the database
4. **Cleanup**: Regularly delete old videos to save disk space

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Change port in .env or use:
   python -m uvicorn main:app --port 8001
   ```

2. **Missing Cascade Files**
   - Ensure `haarcascade_frontalface_default.xml` and `haarcascade_smile.xml` are in the same directory

3. **Whisper Model Download**
   - First run will download the model automatically
   - Ensure internet connection is available

4. **CORS Issues**
   - Check `ALLOWED_ORIGINS` in `.env`
   - Ensure frontend URL is in the allowed origins list

## Dependencies

See `requirements.txt` for full list. Key dependencies:
- FastAPI - Web framework
- SQLAlchemy - ORM
- OpenCV - Video processing
- MediaPipe - Pose detection
- Whisper - Speech recognition
- Passlib - Password hashing

## Security Notes

- Never commit `.env` file with sensitive data
- Use strong passwords for user accounts
- In production, disable OTP printing to frontend
- Use HTTPS in production
- Restrict CORS origins appropriately
- Implement rate limiting for API endpoints

## Contributing

When making changes:
1. Follow PEP 8 style guidelines
2. Add proper type hints
3. Include docstrings for functions
4. Update relevant documentation

## License

[Your License Here]
