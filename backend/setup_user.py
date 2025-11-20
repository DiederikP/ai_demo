#!/usr/bin/env python3
"""
Script to create/update a user in the database with password hashing
Run this from the backend directory with the virtual environment activated
"""

import sys
import os

# Make sure we can import from main
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

# Change to backend directory
os.chdir(backend_dir)

try:
    from passlib.context import CryptContext
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.exc import SQLAlchemyError
    import sqlite3
except ImportError as e:
    print(f"Error importing required modules: {e}")
    print("Make sure you're in the backend directory with venv activated")
    sys.exit(1)

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def setup_user(email: str, password: str, name: str, role: str = "admin"):
    """Create or update a user with password hash"""
    
    # Get database path from environment or use default
    db_path = os.getenv("DATABASE_URL", "sqlite:///./hiring_assistant.db")
    
    # Extract path from SQLite URL if present
    if db_path.startswith("sqlite:///"):
        db_path = db_path.replace("sqlite:///", "")
    
    if not os.path.exists(db_path):
        print(f"Database file not found: {db_path}")
        print("Please make sure the backend has been run at least once to create the database")
        sys.exit(1)
    
    print(f"Connecting to database: {db_path}")
    
    # Connect to SQLite database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if users table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='users'
        """)
        if not cursor.fetchone():
            print("Users table does not exist. Please run the backend at least once.")
            conn.close()
            sys.exit(1)
        
        # Check if password_hash column exists, if not add it
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        if "password_hash" not in columns:
            print("Adding password_hash column...")
            cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
            conn.commit()
        
        # Check if user exists
        cursor.execute("SELECT id, email, name, role, company_id FROM users WHERE email = ?", (email.lower(),))
        existing = cursor.fetchone()
        
        # Get company_id (use default company or first company)
        cursor.execute("SELECT id FROM companies LIMIT 1")
        company_row = cursor.fetchone()
        company_id = company_row[0] if company_row else None
        
        # Hash the password
        password_hash = get_password_hash(password)
        
        if existing:
            # Update existing user
            user_id = existing[0]
            print(f"User {email} already exists. Updating password...")
            cursor.execute("""
                UPDATE users 
                SET password_hash = ?, name = ?, role = ?, is_active = 1
                WHERE id = ?
            """, (password_hash, name, role, user_id))
            print(f"✓ Updated user {email} with new password")
        else:
            # Create new user
            import uuid
            user_id = str(uuid.uuid4())
            print(f"Creating new user {email}...")
            cursor.execute("""
                INSERT INTO users (id, email, name, role, company_id, password_hash, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
            """, (user_id, email.lower(), name, role, company_id, password_hash))
            print(f"✓ Created user {email} with role {role}")
        
        conn.commit()
        
        print()
        print(f"✓ User setup successful!")
        print(f"  Email: {email}")
        print(f"  Name: {name}")
        print(f"  Role: {role}")
        print(f"  Password: {password}")
        print(f"  User ID: {user_id}")
        print(f"  Company ID: {company_id}")
        
        conn.close()
        return True
        
    except SQLAlchemyError as e:
        print(f"Database error: {e}")
        conn.rollback()
        conn.close()
        return False
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        conn.close()
        return False

if __name__ == "__main__":
    # Create the user specified by the user
    email = "vaatje@zuljehemhebben.nl"
    password = "123"
    name = "Vaatje"
    role = "admin"
    
    print("Setting up user:")
    print(f"  Email: {email}")
    print(f"  Password: {password}")
    print(f"  Name: {name}")
    print(f"  Role: {role}")
    print()
    
    success = setup_user(email, password, name, role)
    
    if success:
        print()
        print("✓ User can now login with these credentials!")
        sys.exit(0)
    else:
        print()
        print("✗ Failed to setup user")
        sys.exit(1)

