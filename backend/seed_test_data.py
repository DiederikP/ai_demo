"""
Seed test data for multi-portal system:
- 1 recruiter company
- 2 regular companies (bedrijven)
- ~6 candidates
- Sample vacancies and assignments
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from main import (
    SessionLocal, CompanyDB, UserDB, CandidateDB, JobPostingDB,
    get_password_hash, generate_unique_slug, CandidateDB
)
from sqlalchemy import func
import json

def seed_test_data():
    """Seed test data for multi-portal system"""
    db = SessionLocal()
    try:
        print("=" * 60)
        print("Seeding test data for multi-portal system...")
        print("=" * 60)
        
        # 1. Create Recruiter Company
        print("\n1. Creating Recruiter Company...")
        recruiter_company = db.query(CompanyDB).filter(
            func.lower(CompanyDB.primary_domain) == "recruiter-test.nl"
        ).first()
        
        if not recruiter_company:
            recruiter_company = CompanyDB(
                name="Recruiter Test B.V.",
                slug=generate_unique_slug(db, "recruiter-test"),
                primary_domain="recruiter-test.nl",
                status="active",
                plan="standard"
            )
            db.add(recruiter_company)
            db.commit()
            db.refresh(recruiter_company)
            print(f"  ✓ Created recruiter company: {recruiter_company.name} (ID: {recruiter_company.id})")
        else:
            print(f"  ✓ Recruiter company already exists: {recruiter_company.name}")
        
        # Create recruiter user
        recruiter_user = db.query(UserDB).filter(UserDB.email == "recruiter@recruiter-test.nl").first()
        if not recruiter_user:
            recruiter_user = UserDB(
                email="recruiter@recruiter-test.nl",
                name="Test Recruiter",
                role="recruiter",
                company_id=recruiter_company.id,
                password_hash=get_password_hash("123"),
                is_active=True
            )
            db.add(recruiter_user)
            db.commit()
            print(f"  ✓ Created recruiter user: {recruiter_user.email} (Password: 123)")
        else:
            print(f"  ✓ Recruiter user already exists: {recruiter_user.email}")
        
        # 2. Create 2 Regular Companies
        print("\n2. Creating Regular Companies...")
        companies_data = [
            {
                "name": "Tech Solutions B.V.",
                "domain": "techsolutions.nl",
                "slug": "techsolutions",
                "users": [
                    {"email": "admin@techsolutions.nl", "name": "Admin Tech", "role": "admin", "password": "123"},
                    {"email": "hr@techsolutions.nl", "name": "HR Manager", "role": "viewer", "password": "123"},
                ]
            },
            {
                "name": "Innovation Labs B.V.",
                "domain": "innovationlabs.nl",
                "slug": "innovationlabs",
                "users": [
                    {"email": "admin@innovationlabs.nl", "name": "Admin Innovation", "role": "admin", "password": "123"},
                ]
            }
        ]
        
        created_companies = []
        for company_data in companies_data:
            company = db.query(CompanyDB).filter(
                func.lower(CompanyDB.primary_domain) == company_data["domain"]
            ).first()
            
            if not company:
                company = CompanyDB(
                    name=company_data["name"],
                    slug=generate_unique_slug(db, company_data["slug"]),
                    primary_domain=company_data["domain"],
                    status="active",
                    plan="standard"
                )
                db.add(company)
                db.commit()
                db.refresh(company)
                print(f"  ✓ Created company: {company.name} (ID: {company.id})")
            else:
                print(f"  ✓ Company already exists: {company.name}")
            
            # Create users for company
            for user_data in company_data["users"]:
                user = db.query(UserDB).filter(UserDB.email == user_data["email"]).first()
                if not user:
                    user = UserDB(
                        email=user_data["email"],
                        name=user_data["name"],
                        role=user_data["role"],
                        company_id=company.id,
                        password_hash=get_password_hash(user_data["password"]),
                        is_active=True
                    )
                    db.add(user)
                    print(f"    ✓ Created user: {user.email} (Password: {user_data['password']})")
                else:
                    print(f"    ✓ User already exists: {user.email}")
            
            created_companies.append(company)
        
        db.commit()
        
        # 3. Create ~6 Candidates
        print("\n3. Creating Candidates...")
        candidates_data = [
            {
                "name": "Jan Janssen",
                "email": "jan.janssen@example.com",
                "resume": "Jan Janssen heeft 5 jaar ervaring als Software Developer bij verschillende bedrijven.",
                "location": "Amsterdam",
                "years_experience": 5,
                "skill_tags": ["Python", "JavaScript", "React"],
                "salary_expectation": 4500,
                "submitted_by": None,  # Direct application or company submitted
            },
            {
                "name": "Maria de Vries",
                "email": "maria.devries@example.com",
                "resume": "Maria de Vries is Senior Frontend Developer met expertise in React en Vue.js.",
                "location": "Rotterdam",
                "years_experience": 8,
                "skill_tags": ["React", "Vue.js", "TypeScript", "Node.js"],
                "salary_expectation": 5500,
                "submitted_by": recruiter_company.id,  # Submitted by recruiter
            },
            {
                "name": "Pieter Bakker",
                "email": "pieter.bakker@example.com",
                "resume": "Pieter Bakker werkt als Full Stack Developer en heeft ervaring met Python en Django.",
                "location": "Utrecht",
                "years_experience": 3,
                "skill_tags": ["Python", "Django", "PostgreSQL"],
                "salary_expectation": 4000,
                "submitted_by": recruiter_company.id,
            },
            {
                "name": "Lisa van den Berg",
                "email": "lisa.vandenberg@example.com",
                "resume": "Lisa van den Berg is een ervaren Product Manager met technische achtergrond.",
                "location": "Den Haag",
                "years_experience": 7,
                "skill_tags": ["Product Management", "Agile", "Scrum"],
                "salary_expectation": 6000,
                "submitted_by": None,
            },
            {
                "name": "Tom Smit",
                "email": "tom.smit@example.com",
                "resume": "Tom Smit is Junior Developer met goede kennis van JavaScript en React.",
                "location": "Amsterdam",
                "years_experience": 2,
                "skill_tags": ["JavaScript", "React", "HTML", "CSS"],
                "salary_expectation": 3500,
                "submitted_by": recruiter_company.id,
            },
            {
                "name": "Sophie Jansen",
                "email": "sophie.jansen@example.com",
                "resume": "Sophie Jansen is Data Engineer met expertise in Python, SQL en cloud platforms.",
                "location": "Amsterdam",
                "years_experience": 4,
                "skill_tags": ["Python", "SQL", "AWS", "Data Engineering"],
                "salary_expectation": 5000,
                "submitted_by": None,
            }
        ]
        
        created_candidates = []
        for candidate_data in candidates_data:
            # Check if candidate exists
            candidate = db.query(CandidateDB).filter(
                func.lower(CandidateDB.email) == candidate_data["email"].lower()
            ).first()
            
            if not candidate:
                candidate = CandidateDB(
                    name=candidate_data["name"],
                    email=candidate_data["email"],
                    resume_text=candidate_data["resume"],
                    location=candidate_data["location"],
                    years_experience=candidate_data["years_experience"],
                    experience_years=candidate_data["years_experience"],
                    skill_tags=json.dumps(candidate_data["skill_tags"]),
                    salary_expectation=candidate_data["salary_expectation"],
                    submitted_by_company_id=candidate_data["submitted_by"],
                    pipeline_stage="introduced",
                    pipeline_status="active",
                )
                db.add(candidate)
                created_candidates.append(candidate)
                print(f"  ✓ Created candidate: {candidate.name} ({candidate.email})")
            else:
                print(f"  ✓ Candidate already exists: {candidate.name}")
                created_candidates.append(candidate)
        
        db.commit()
        
        # 4. Create Sample Vacancies
        print("\n4. Creating Sample Vacancies...")
        vacancies_data = [
            {
                "title": "Senior Frontend Developer",
                "company": "Tech Solutions B.V.",
                "description": "We zijn op zoek naar een ervaren Frontend Developer voor onze groeiende tech team.",
                "requirements": "Minimaal 5 jaar ervaring met React, TypeScript en moderne frontend tools.",
                "location": "Amsterdam",
                "salary_range": "€4500 - €6000",
                "company_id": created_companies[0].id,
            },
            {
                "title": "Full Stack Developer",
                "company": "Tech Solutions B.V.",
                "description": "Vacature voor een Full Stack Developer met kennis van Python en JavaScript.",
                "requirements": "Ervaring met Python, Django, React of Vue.js.",
                "location": "Amsterdam",
                "salary_range": "€4000 - €5500",
                "company_id": created_companies[0].id,
            },
            {
                "title": "Product Manager",
                "company": "Innovation Labs B.V.",
                "description": "We zoeken een ervaren Product Manager voor onze product development team.",
                "requirements": "Minimaal 5 jaar ervaring als Product Manager, technische achtergrond gewenst.",
                "location": "Rotterdam",
                "salary_range": "€5500 - €7000",
                "company_id": created_companies[1].id,
            },
        ]
        
        created_vacancies = []
        for vacancy_data in vacancies_data:
            vacancy = JobPostingDB(
                title=vacancy_data["title"],
                company=vacancy_data["company"],
                description=vacancy_data["description"],
                requirements=vacancy_data["requirements"],
                location=vacancy_data["location"],
                salary_range=vacancy_data["salary_range"],
                company_id=vacancy_data["company_id"],
                is_active=True,
            )
            db.add(vacancy)
            created_vacancies.append(vacancy)
            print(f"  ✓ Created vacancy: {vacancy.title} bij {vacancy.company}")
        
        db.commit()
        
        # 5. Assign some candidates to vacancies and recruiter
        print("\n5. Assigning Candidates to Vacancies...")
        
        # Assign recruiter to first vacancy
        if created_vacancies and recruiter_user:
            created_vacancies[0].assigned_agency_id = recruiter_user.id
            print(f"  ✓ Assigned recruiter to vacancy: {created_vacancies[0].title}")
        
        # Assign some candidates to vacancies
        if created_candidates and created_vacancies:
            # Maria to first vacancy (via recruiter)
            created_candidates[1].job_id = created_vacancies[0].id
            print(f"  ✓ Assigned {created_candidates[1].name} to {created_vacancies[0].title}")
            
            # Pieter to first vacancy (via recruiter)
            created_candidates[2].preferential_job_ids = created_vacancies[0].id
            print(f"  ✓ Assigned {created_candidates[2].name} to {created_vacancies[0].title} (preferential)")
            
            # Jan to second vacancy
            created_candidates[0].job_id = created_vacancies[1].id
            print(f"  ✓ Assigned {created_candidates[0].name} to {created_vacancies[1].title}")
            
            # Lisa to third vacancy
            created_candidates[3].job_id = created_vacancies[2].id
            print(f"  ✓ Assigned {created_candidates[3].name} to {created_vacancies[2].title}")
        
        db.commit()
        
        print("\n" + "=" * 60)
        print("✓ Test data seeding completed successfully!")
        print("=" * 60)
        print("\nTest Accounts:")
        print("  Recruiter:")
        print(f"    Email: recruiter@recruiter-test.nl")
        print(f"    Password: 123")
        print("\n  Companies:")
        for company_data in companies_data:
            print(f"    {company_data['name']}:")
            for user_data in company_data["users"]:
                print(f"      - {user_data['email']} (Password: {user_data['password']})")
        print(f"\n  Candidates: {len(created_candidates)} candidates created")
        print(f"  Vacancies: {len(created_vacancies)} vacancies created")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Error seeding test data: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_test_data()

