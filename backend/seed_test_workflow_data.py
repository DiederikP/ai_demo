#!/usr/bin/env python3
"""
Seed test data for workflow testing:
- Barnes as recruiter company
- Client as company
- ~6 candidates assigned to vacancies
"""

import os
import sys
from datetime import datetime

# Add parent directory to path to import from main.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import (
    Base, CompanyDB, UserDB, JobPostingDB, CandidateDB,
    get_password_hash, SessionLocal
)

def seed_test_workflow_data():
    """Seed test data for workflow testing"""
    db = SessionLocal()
    try:
        print("🌱 Seeding test workflow data...")
        print("=" * 60)
        
        # 1. Create or get "Barnes" recruiter company
        print("\n1. Creating recruiter company 'Barnes'...")
        barnes_company = db.query(CompanyDB).filter(CompanyDB.name == "Barnes").first()
        if not barnes_company:
            barnes_company = CompanyDB(
                name="Barnes",
                slug="barnes",
                plan="pro",
                status="active"
            )
            db.add(barnes_company)
            db.commit()
            db.refresh(barnes_company)
            print(f"   ✅ Created Barnes company (ID: {barnes_company.id})")
        else:
            print(f"   ✅ Barnes company already exists (ID: {barnes_company.id})")
        
        # 2. Create or get "Client" company
        print("\n2. Creating company 'Client'...")
        client_company = db.query(CompanyDB).filter(CompanyDB.name == "Client").first()
        if not client_company:
            client_company = CompanyDB(
                name="Client",
                slug="client",
                plan="pro",
                status="active"
            )
            db.add(client_company)
            db.commit()
            db.refresh(client_company)
            print(f"   ✅ Created Client company (ID: {client_company.id})")
        else:
            print(f"   ✅ Client company already exists (ID: {client_company.id})")
        
        # 3. Create recruiter user for Barnes
        print("\n3. Creating recruiter user for Barnes...")
        recruiter_email = "recruiter@barnes.nl"
        recruiter_user = db.query(UserDB).filter(UserDB.email == recruiter_email).first()
        if not recruiter_user:
            recruiter_user = UserDB(
                email=recruiter_email,
                name="Barnes Recruiter",
                role="recruiter",
                company_id=barnes_company.id,
                password_hash=get_password_hash("123"),
                is_active=True
            )
            db.add(recruiter_user)
            db.commit()
            db.refresh(recruiter_user)
            print(f"   ✅ Created recruiter user: {recruiter_email} (password: 123)")
        else:
            recruiter_user.company_id = barnes_company.id
            recruiter_user.role = "recruiter"
            db.commit()
            print(f"   ✅ Updated recruiter user: {recruiter_email}")
        
        # 4. Create company admin user for Client
        print("\n4. Creating company admin user for Client...")
        client_email = "admin@client.nl"
        client_user = db.query(UserDB).filter(UserDB.email == client_email).first()
        if not client_user:
            client_user = UserDB(
                email=client_email,
                name="Client Admin",
                role="company_admin",
                company_id=client_company.id,
                password_hash=get_password_hash("123"),
                is_active=True
            )
            db.add(client_user)
            db.commit()
            db.refresh(client_user)
            print(f"   ✅ Created company admin user: {client_email} (password: 123)")
        else:
            client_user.company_id = client_company.id
            client_user.role = "company_admin"
            db.commit()
            print(f"   ✅ Updated company admin user: {client_email}")
        
        # 5. Create a test vacancy for Client
        print("\n5. Creating test vacancy for Client...")
        test_vacancy = db.query(JobPostingDB).filter(
            JobPostingDB.title == "Test Vacature",
            JobPostingDB.company_id == client_company.id
        ).first()
        if not test_vacancy:
            test_vacancy = JobPostingDB(
                title="Test Vacature",
                company="Client",
                description="Dit is een test vacature voor workflow testing.",
                requirements="Ervaring met Python, React, en databases.",
                location="Amsterdam",
                salary_range="€50.000 - €70.000",
                company_id=client_company.id,
                is_active=True,
                created_at=datetime.now()
            )
            db.add(test_vacancy)
            db.commit()
            db.refresh(test_vacancy)
            print(f"   ✅ Created test vacancy: {test_vacancy.title} (ID: {test_vacancy.id})")
        else:
            print(f"   ✅ Test vacancy already exists (ID: {test_vacancy.id})")
        
        # 6. Get existing candidates or create test candidates
        print("\n6. Assigning candidates to vacancy...")
        all_candidates = db.query(CandidateDB).limit(6).all()
        
        if len(all_candidates) < 6:
            print(f"   ⚠️  Only {len(all_candidates)} candidates found in database")
            print(f"   💡 Tip: Upload more resumes to have 6 candidates available")
        
        assigned_count = 0
        for i, candidate in enumerate(all_candidates[:6]):
            # Assign candidate to test vacancy and set as submitted by recruiter
            candidate.job_id = test_vacancy.id
            candidate.submitted_by_company_id = barnes_company.id
            if not candidate.company_note:
                candidate.company_note = f"Test kandidaat {i+1} - Voorgesteld door Barnes recruiter"
            assigned_count += 1
        
        db.commit()
        print(f"   ✅ Assigned {assigned_count} candidates to test vacancy")
        print(f"      - All candidates marked as submitted by Barnes recruiter")
        print(f"      - All candidates assigned to test vacancy")
        
        print("\n" + "=" * 60)
        print("✅ Test workflow data seeded successfully!")
        print("\n📋 Test Accounts:")
        print(f"   Recruiter: {recruiter_email} / 123")
        print(f"   Company Admin: {client_email} / 123")
        print(f"\n📊 Test Data:")
        print(f"   - Recruiter Company: Barnes (ID: {barnes_company.id})")
        print(f"   - Client Company: Client (ID: {client_company.id})")
        print(f"   - Test Vacancy: {test_vacancy.title} (ID: {test_vacancy.id})")
        print(f"   - Assigned Candidates: {assigned_count}")
        print("\n💡 Next Steps:")
        print("   1. Login as recruiter@barnes.nl to see the test vacancy")
        print("   2. Add candidates to the vacancy")
        print("   3. Login as admin@client.nl to see proposed candidates")
        print("   4. Start evaluation from the company portal")
        
    except Exception as e:
        print(f"\n❌ Error seeding test data: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_test_workflow_data()

