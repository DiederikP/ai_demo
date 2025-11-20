#!/usr/bin/env python3
"""
Quick script to create/update user with password using direct database access
Works without importing from main.py
"""

import sqlite3
import bcrypt
import uuid
from datetime import datetime

# Database path
DB_PATH = "./ai_hiring.db"

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def setup_user(email: str, password: str, name: str, role: str = "admin"):
    """Create or update user"""
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if not cursor.fetchone():
            print("Error: users table does not exist")
            print("Please run the backend at least once to create the database")
            conn.close()
            return False
        
        # Check if password_hash column exists
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        if "password_hash" not in columns:
            print("Adding password_hash column...")
            cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
            conn.commit()
        
        # Get company_id (first company)
        cursor.execute("SELECT id FROM companies LIMIT 1")
        company_row = cursor.fetchone()
        company_id = company_row[0] if company_row else None
        
        # Check if user exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (email.lower(),))
        existing = cursor.fetchone()
        
        # Hash password
        password_hash = hash_password(password)
        
        if existing:
            # Update existing user
            user_id = existing[0]
            print(f"User {email} already exists. Updating password...")
            cursor.execute("""
                UPDATE users 
                SET password_hash = ?, name = ?, role = ?, is_active = 1
                WHERE id = ?
            """, (password_hash, name, role, user_id))
            print(f"✓ Updated user {email}")
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            print(f"Creating new user {email}...")
            cursor.execute("""
                INSERT INTO users (id, email, name, role, company_id, password_hash, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            """, (user_id, email.lower(), name, role, company_id, password_hash, datetime.now().isoformat()))
            print(f"✓ Created user {email}")
        
        conn.commit()
        conn.close()
        
        print()
        print(f"✓ User setup successful!")
        print(f"  Email: {email}")
        print(f"  Password: {password}")
        print(f"  Name: {name}")
        print(f"  Role: {role}")
        print(f"  User ID: {user_id}")
        print(f"  Company ID: {company_id}")
        
        return True
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        if 'conn' in locals():
            conn.close()
        return False
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals():
            conn.close()
        return False

if __name__ == "__main__":
    # Setup user
    email = "vaatje@zuljehemhebben.nl"
    password = "123"
    name = "Vaatje"
    role = "admin"
    
    print("Setting up user...")
    print(f"  Email: {email}")
    print(f"  Password: {password}")
    print(f"  Name: {name}")
    print(f"  Role: {role}")
    print()
    
    success = setup_user(email, password, name, role)
    
    if success:
        print()
        print("✓ User can now login with these credentials!")
    else:
        print()
        print("✗ Failed to setup user")

