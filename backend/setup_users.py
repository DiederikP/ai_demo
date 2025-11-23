#!/usr/bin/env python3
"""
Script to set up users with role-based access:
- 1 admin user (full access to all portals)
- 1 company user (only Bedrijf portal)
- 1 recruiter user (only Recruiter portal)
- 1 candidate user (only Candidate portal)

All users are in the same environment/company so they can see each other's data.
"""

import sys
import os

# Add parent directory to path to import from main.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import (
    SessionLocal, UserDB, CompanyDB, get_password_hash,
    JobPostingDB, CandidateDB, EvaluationDB, EvaluationResultDB,
    NotificationDB, CommentDB, ScheduledAppointmentDB,
    CandidateConversationDB, JobWatcherDB, CandidateWatcherDB, ApprovalDB
)
from sqlalchemy import func

def clear_all_data():
    """Remove all old data from the database, keeping only the 4 specified users"""
    print("Clearing all old data (except specified users)...")
    db = SessionLocal()
    try:
        # Keep these user emails
        keep_emails = [
            "admin@demo.local",
            "user@company.nl",
            "user@recruiter.nl",
            "user@kandidaat.nl"
        ]
        
        # Get IDs of users to keep
        users_to_keep = db.query(UserDB).filter(UserDB.email.in_(keep_emails)).all()
        user_ids_to_keep = [u.id for u in users_to_keep]
        
        print(f"Keeping {len(user_ids_to_keep)} users: {keep_emails}")
        
        # Delete in order to respect foreign key constraints
        # Delete approvals for users we're deleting
        if user_ids_to_keep:
            db.query(ApprovalDB).filter(~ApprovalDB.user_id.in_(user_ids_to_keep)).delete(synchronize_session=False)
        else:
            db.query(ApprovalDB).delete()
        
        db.query(CandidateWatcherDB).delete()
        db.query(JobWatcherDB).delete()
        db.query(CandidateConversationDB).delete()
        db.query(ScheduledAppointmentDB).delete()
        db.query(CommentDB).delete()
        db.query(NotificationDB).delete()
        db.query(EvaluationResultDB).delete()
        db.query(EvaluationDB).delete()
        db.query(CandidateDB).delete()
        db.query(JobPostingDB).delete()
        
        # Delete users except the ones we want to keep
        if user_ids_to_keep:
            db.query(UserDB).filter(~UserDB.id.in_(user_ids_to_keep)).delete(synchronize_session=False)
            print(f"✓ Deleted all users except {len(user_ids_to_keep)} specified users")
        else:
            db.query(UserDB).delete()
            print("✓ Deleted all users (none to keep)")
        
        # Delete companies that aren't needed (we'll recreate them)
        db.query(CompanyDB).delete()
        
        db.commit()
        print("✓ All old data cleared (except specified users)")
    except Exception as e:
        db.rollback()
        print(f"Error clearing data: {e}")
        raise
    finally:
        db.close()

def setup_users():
    """Create users with proper roles and access"""
    print("\nSetting up users...")
    db = SessionLocal()
    try:
        # Create a single company/environment for all users
        company = CompanyDB(
            name="Demo Environment",
            slug="demo-environment",
            primary_domain="demo.local",
            status="active",
            plan="trial"
        )
        db.add(company)
        db.commit()
        db.refresh(company)
        print(f"✓ Created company: {company.name} (ID: {company.id})")
        
        # All users in same environment/company so they can see each other's data
        # 1. Admin user - full access to all portals
        admin_user = db.query(UserDB).filter(UserDB.email == "admin@demo.local").first()
        if admin_user:
            # Update existing admin user
            admin_user.name = "Admin User"
            admin_user.role = "admin"
            admin_user.company_id = company.id
            admin_user.password_hash = get_password_hash("admin123")
            admin_user.is_active = True
            print("✓ Updated admin user: admin@demo.local (password: admin123)")
        else:
            admin_user = UserDB(
                email="admin@demo.local",
                name="Admin User",
                role="admin",
                company_id=company.id,  # In same environment
                password_hash=get_password_hash("admin123"),
                is_active=True
            )
            db.add(admin_user)
            print("✓ Created admin user: admin@demo.local (password: admin123)")
        
        # 2. Company user - only Bedrijf portal
        company_user = db.query(UserDB).filter(UserDB.email == "user@company.nl").first()
        if company_user:
            # Update existing company user
            company_user.name = "Company User"
            company_user.role = "company_admin"
            company_user.company_id = company.id
            company_user.password_hash = get_password_hash("company123")
            company_user.is_active = True
            print("✓ Updated company user: user@company.nl (password: company123)")
        else:
            company_user = UserDB(
                email="user@company.nl",
                name="Company User",
                role="company_admin",  # Company admin role
                company_id=company.id,  # Same environment
                password_hash=get_password_hash("company123"),
                is_active=True
            )
            db.add(company_user)
            print("✓ Created company user: user@company.nl (password: company123)")
        
        # 3. Recruiter user - only Recruiter portal
        # Create recruiter company but assign to same main company for data visibility
        recruiter_company = db.query(CompanyDB).filter(CompanyDB.slug == "recruiter-company").first()
        if not recruiter_company:
            recruiter_company = CompanyDB(
                name="Recruiter Company",
                slug="recruiter-company",
                primary_domain="recruiter.local",
                status="active",
                plan="trial"
            )
            db.add(recruiter_company)
            db.commit()
            db.refresh(recruiter_company)
            print(f"✓ Created recruiter company: {recruiter_company.name} (ID: {recruiter_company.id})")
        else:
            print(f"✓ Using existing recruiter company: {recruiter_company.name} (ID: {recruiter_company.id})")
        
        recruiter_user = db.query(UserDB).filter(UserDB.email == "user@recruiter.nl").first()
        if recruiter_user:
            # Update existing recruiter user
            recruiter_user.name = "Recruiter User"
            recruiter_user.role = "recruiter"
            recruiter_user.company_id = recruiter_company.id
            recruiter_user.password_hash = get_password_hash("recruiter123")
            recruiter_user.is_active = True
            print("✓ Updated recruiter user: user@recruiter.nl (password: recruiter123)")
        else:
            recruiter_user = UserDB(
                email="user@recruiter.nl",
                name="Recruiter User",
                role="recruiter",
                company_id=recruiter_company.id,  # Recruiter company
                password_hash=get_password_hash("recruiter123"),
                is_active=True
            )
            db.add(recruiter_user)
            print("✓ Created recruiter user: user@recruiter.nl (password: recruiter123)")
        
        # 4. Candidate user - only Candidate portal
        candidate_user = db.query(UserDB).filter(UserDB.email == "user@kandidaat.nl").first()
        if candidate_user:
            # Update existing candidate user
            candidate_user.name = "Candidate User"
            candidate_user.role = "candidate"
            candidate_user.company_id = None
            candidate_user.password_hash = get_password_hash("kandidaat123")
            candidate_user.is_active = True
            print("✓ Updated candidate user: user@kandidaat.nl (password: kandidaat123)")
        else:
            candidate_user = UserDB(
                email="user@kandidaat.nl",
                name="Candidate User",
                role="candidate",  # Candidate role
                company_id=None,  # Candidates don't belong to a company
                password_hash=get_password_hash("kandidaat123"),
                is_active=True
            )
            db.add(candidate_user)
            print("✓ Created candidate user: user@kandidaat.nl (password: kandidaat123)")
        
        db.commit()
        print("\n✓ All users created successfully!")
        print("\nLogin credentials:")
        print("  Admin:      admin@demo.local / admin123")
        print("  Company:    user@company.nl / company123")
        print("  Recruiter:  user@recruiter.nl / recruiter123")
        print("  Candidate:  user@kandidaat.nl / kandidaat123")
        
    except Exception as e:
        db.rollback()
        print(f"Error setting up users: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    try:
        # Clear old data first
        clear_all_data()
        
        # Then set up new users
        setup_users()
        
        print("\n✓ Setup complete!")
        
    except Exception as e:
        print(f"\n✗ Setup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

