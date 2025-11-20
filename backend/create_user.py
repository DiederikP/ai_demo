#!/usr/bin/env python3
"""
Script to create a user in the database with password hashing
"""

import sys
import os

# Add parent directory to path to import main modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import UserDB, CompanyDB, get_password_hash, get_or_create_company_by_domain, SessionLocal, Base

def create_user(email: str, password: str, name: str, role: str = "admin", company_id: str = None):
    """Create a user with password hash"""
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(UserDB).filter(UserDB.email == email.lower()).first()
        if existing_user:
            print(f"User {email} already exists. Updating password...")
            existing_user.password_hash = get_password_hash(password)
            existing_user.name = name
            existing_user.role = role
            existing_user.is_active = True
            if company_id:
                existing_user.company_id = company_id
            db.commit()
            print(f"✓ Updated user {email} with new password")
            db.close()
            return existing_user
        
        # Get or create company if company_id not provided
        company = None
        if company_id:
            company = db.query(CompanyDB).filter(CompanyDB.id == company_id).first()
            if not company:
                print(f"Company {company_id} not found")
                db.close()
                return None
        else:
            # Extract domain from email
            domain = email.split('@')[1] if '@' in email else None
            company = get_or_create_company_by_domain(db, domain, name)
        
        # Create new user
        password_hash = get_password_hash(password)
        new_user = UserDB(
            email=email.lower(),
            name=name,
            password_hash=password_hash,
            role=role,
            company_id=company.id if company else None,
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        print(f"✓ Created user {email} with role {role}")
        print(f"  User ID: {new_user.id}")
        print(f"  Company ID: {new_user.company_id}")
        print(f"  Password hash: {password_hash[:20]}...")
        
        db.close()
        return new_user
        
    except Exception as e:
        print(f"✗ Error creating user: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        db.close()
        return None

if __name__ == "__main__":
    # Create the user specified by the user
    email = "vaatje@zuljehemhebben.nl"
    password = "123"
    name = "Vaatje"
    role = "admin"
    
    print(f"Creating user: {email}")
    print(f"Password: {password}")
    print(f"Role: {role}")
    print()
    
    user = create_user(email, password, name, role)
    
    if user:
        print()
        print("✓ User created/updated successfully!")
        sys.exit(0)
    else:
        print()
        print("✗ Failed to create user")
        sys.exit(1)

