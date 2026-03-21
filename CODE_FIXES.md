# Confidence AI - Code Fix Examples

## 🔴 CRITICAL FIX #1: Password Security (POST Body)

### Current Code (❌ INSECURE)
```javascript
// pages/Login.js
const handleLogin = async (e) => {
  const response = await fetch(
    `${API_BASE_URL}/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    { method: "POST" }
  );
}
```

**Problems:**
- Password visible in URL
- Stored in browser history
- Logged in server logs
- Visible in analytics

---

### Fixed Code (✅ SECURE)
```javascript
// pages/Login.js
const handleLogin = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError("");

  try {
    const response = await fetch(
      `${API_BASE_URL}/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }
    );

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const data = await response.json();
    // Handle success...
  } catch (error) {
    setError("Login failed. Please try again.");
  } finally {
    setLoading(false);
  }
};
```

**Backend Update:**
```python
# main.py
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

@app.post("/login")
def login(request: LoginRequest) -> dict:
    """Login user with email and password"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == request.email).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if not user.is_verified:
            raise HTTPException(status_code=400, detail="Email not verified")
        
        if not verify_password(request.password, user.password):
            raise HTTPException(status_code=401, detail="Incorrect password")
        
        logger.info(f"User logged in: {request.email}")
        
        return {
            "message": "Login successful",
            "email": user.email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error logging in")
    finally:
        db.close()
```

---

## 🔴 CRITICAL FIX #2: Input Validation (Pydantic)

### Current Code (❌ NO VALIDATION)
```python
@app.post("/signup")
def signup(email: str, password: str) -> dict:
    """Endpoints accepts any string, no validation"""
    db = SessionLocal()
    # ... rest of code
```

**Problems:**
- No email format validation
- No password strength requirements
- No length limits
- Invalid data accepted

---

### Fixed Code (✅ WITH VALIDATION)
```python
# schemas.py
from pydantic import BaseModel, EmailStr, Field, validator

class SignupRequest(BaseModel):
    email: EmailStr  # Validates email format
    password: str = Field(
        min_length=8,
        max_length=128,
        description="Password must be 8-128 characters"
    )
    
    @validator('password')
    def password_strength(cls, v):
        """Validate password contains mix of characters"""
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain number')
        return v

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(regex=r'^\d{6}$')  # Must be 6 digits

# main.py
@app.post("/signup")
def signup(request: SignupRequest) -> dict:
    """Register a new user with validation"""
    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(
            User.email == request.email
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )
        
        # Generate OTP
        otp = str(random.randint(100000, 999999))
        otp_expiry = datetime.utcnow() + timedelta(minutes=5)
        
        # Create new user
        new_user = User(
            email=request.email,
            password=hash_password(request.password),
            otp=otp,
            otp_expiry=otp_expiry,
            is_verified=False
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(f"New user registered: {request.email}")
        
        return {
            "message": "User created successfully",
            "dev_otp": otp  # Only in development
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error during signup: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Error creating user"
        )
    finally:
        db.close()
```

---

## 🔴 CRITICAL FIX #3: API Service Layer

### Current Code (❌ DUPLICATED)
```javascript
// Login.js
const response = await fetch(`${API_BASE_URL}/login`, { ... });

// Signup.js
const response = await fetch(`${API_BASE_URL}/signup`, { ... });

// Dashboard.js
const response = await fetch(`${API_BASE_URL}/dashboard`, { ... });

// This repeats in 5+ files!
```

---

### Fixed Code (✅ SERVICE LAYER)
```javascript
// services/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
};

export const authAPI = {
  signup: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  verifyOTP: async (email, otp) => {
    const response = await fetch(`${API_BASE_URL}/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    return handleResponse(response);
  },
};

export const analysisAPI = {
  analyzeVideo: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      body: formData,
    });
    return handleResponse(response);
  },

  getDashboard: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard`);
    return handleResponse(response);
  },

  deleteAnalysis: async (id) => {
    const response = await fetch(`${API_BASE_URL}/delete/${id}`, {
      method: "DELETE",
    });
    return handleResponse(response);
  },
};

// Usage in Login.js
import { authAPI } from "../services/api";

const handleLogin = async (e) => {
  e.preventDefault();
  try {
    const data = await authAPI.login(email, password);
    // Handle success
  } catch (error) {
    setError(error.message);
  }
};
```

---

## 🟠 HIGH PRIORITY FIX #4: Error Boundary Component

### Fixed Code (✅ ERROR BOUNDARY)
```javascript
// components/ErrorBoundary.js
import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught:", error, errorInfo);
    // Log to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.errorContainer}>
          <h2>⚠️ Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  errorContainer: {
    padding: "20px",
    backgroundColor: "#ff6b6b",
    color: "white",
    borderRadius: "5px",
    textAlign: "center",
  },
};

export default ErrorBoundary;

// App.js
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppWrapper />
      </Router>
    </ErrorBoundary>
  );
}
```

---

## 🟠 HIGH PRIORITY FIX #5: API Documentation (Swagger)

### Updated Backend Code (✅ WITH DOCS)
```python
# main.py
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

app = FastAPI(
    title="Confidence AI API",
    description="AI-powered confidence analysis system for personal development",
    version="1.0.0",
    contact={
        "name": "Support",
        "url": "https://confidence-ai.example.com",
        "email": "support@confidence-ai.example.com",
    },
    docs_url="/docs",      # Swagger UI at /docs
    redoc_url="/redoc",    # ReDoc at /redoc
)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Confidence AI API",
        version="1.0.0",
        routes=app.routes,
    )
    
    openapi_schema["info"]["x-logo"] = {
        "url": "https://confidence-ai.example.com/logo.png"
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.post(
    "/signup",
    tags=["Authentication"],
    summary="Register new user",
    responses={
        200: {
            "description": "User created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "message": "User created",
                        "dev_otp": "123456"
                    }
                }
            }
        },
        400: {"description": "Email already registered"},
        500: {"description": "Server error"}
    }
)
def signup(request: SignupRequest) -> dict:
    """
    Register a new user with email and password.
    
    - **email**: Valid email address
    - **password**: At least 8 characters with uppercase and number
    """
    # Implementation...
```

Now visit `http://localhost:8000/docs` for interactive API documentation!

---

## 🟠 HIGH PRIORITY FIX #6: Unit Tests

### Test Example (✅ WITH TESTS)
```python
# tests/test_endpoints.py
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

class TestAuthentication:
    def test_signup_valid(self):
        response = client.post(
            "/signup",
            json={
                "email": "test@example.com",
                "password": "Test1234"
            }
        )
        assert response.status_code == 200
        assert "dev_otp" in response.json()

    def test_signup_invalid_email(self):
        response = client.post(
            "/signup",
            json={
                "email": "invalid-email",
                "password": "Test1234"
            }
        )
        assert response.status_code == 422  # Validation error

    def test_signup_weak_password(self):
        response = client.post(
            "/signup",
            json={
                "email": "test@example.com",
                "password": "weak"
            }
        )
        assert response.status_code == 422

    def test_signup_duplicate_email(self):
        # First signup
        client.post(
            "/signup",
            json={
                "email": "test@example.com",
                "password": "Test1234"
            }
        )
        # Duplicate signup
        response = client.post(
            "/signup",
            json={
                "email": "test@example.com",
                "password": "Test1234"
            }
        )
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]
```

---

## 📊 IMPLEMENTATION CHECKLIST

- [ ] **Week 1:**
  - [ ] Fix password transmission (POST body)
  - [ ] Add Pydantic validation models
  - [ ] Add error boundary component
  - [ ] Test all auth endpoints

- [ ] **Week 2:**
  - [ ] Create API service layer
  - [ ] Add unit tests
  - [ ] Add API documentation (Swagger)
  - [ ] Remove console.log statements

- [ ] **Week 3:**
  - [ ] Implement missing video features
  - [ ] Add frontend form validation
  - [ ] Add database migrations
  - [ ] Complete test coverage

---

These examples provide the foundation for fixing the critical issues. Each fix is self-contained and can be implemented independently.

