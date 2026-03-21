from database import SessionLocal
from models import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

session = SessionLocal()

# Check if user exists
existing = session.query(User).filter(User.email == 'abhay@gmail.com').first()
if existing:
    print(f"✓ User already exists: {existing.email}")
else:
    # Create new user
    test_user = User(
        email='abhay@gmail.com',
        password=pwd_context.hash('password123'),
        is_verified=True
    )
    session.add(test_user)
    session.commit()
    print("✓ Test user created: abhay@gmail.com / password123")

session.close()
