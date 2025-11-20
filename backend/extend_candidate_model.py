#!/usr/bin/env python3
"""
Extend CandidateDB model with additional fields
This script adds new columns to the candidates table for enhanced candidate data
"""

import sys
import os
from sqlalchemy import create_engine, text, Column, String, Integer, Text, Float
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError

def extend_candidate_table():
    """Add new columns to candidates table"""
    try:
        DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ai_hiring.db")
        
        if DATABASE_URL.startswith("sqlite"):
            engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
        else:
            engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
        
        with engine.connect() as conn:
            # Check if columns already exist
            inspector = __import__('sqlalchemy', fromlist=['inspect']).inspect(engine)
            existing_columns = [col['name'] for col in inspector.get_columns('candidates')]
            
            new_columns = {
                'motivation_reason': 'TEXT',  # Motivation for role / reason for leaving
                'test_results': 'TEXT',  # Test results or skill scores (JSON)
                'age': 'INTEGER',
                'years_experience': 'INTEGER',  # Already exists, check first
                'skill_tags': 'TEXT',  # JSON array of skill tags
                'prior_job_titles': 'TEXT',  # JSON array of prior job titles
                'certifications': 'TEXT',  # JSON array of certifications
                'education_level': 'TEXT',  # e.g., "Bachelor", "Master", "PhD"
                'location': 'TEXT',
                'communication_level': 'TEXT',  # e.g., "Native", "Fluent", "Intermediate"
                'availability_per_week': 'INTEGER',  # Hours per week
                'notice_period': 'TEXT',  # e.g., "2 weeks", "1 month"
                'salary_expectation': 'INTEGER',  # EUR per 40h
                'source': 'TEXT',  # How candidate was sourced (e.g., "LinkedIn", "Agency XYZ", "Direct")
                'pipeline_stage': 'TEXT',  # e.g., "introduced", "review", "first_interview", "second_interview", "offer", "complete"
                'pipeline_status': 'TEXT',  # e.g., "active", "on_hold", "rejected", "accepted"
            }
            
            print("📊 Extending candidates table...")
            print(f"   Existing columns: {', '.join(existing_columns)}")
            
            added_columns = []
            skipped_columns = []
            
            for column_name, column_type in new_columns.items():
                if column_name in existing_columns:
                    print(f"   ⏭️  {column_name} already exists")
                    skipped_columns.append(column_name)
                    continue
                
                try:
                    # SQLite uses slightly different syntax
                    if DATABASE_URL.startswith("sqlite"):
                        alter_sql = f"ALTER TABLE candidates ADD COLUMN {column_name} {column_type}"
                    else:
                        # PostgreSQL
                        alter_sql = f"ALTER TABLE candidates ADD COLUMN {column_name} {column_type}"
                    
                    conn.execute(text(alter_sql))
                    conn.commit()
                    print(f"   ✅ Added column: {column_name} ({column_type})")
                    added_columns.append(column_name)
                except Exception as e:
                    print(f"   ❌ Failed to add {column_name}: {e}")
            
            print(f"\n✅ Added {len(added_columns)} new columns")
            if skipped_columns:
                print(f"   ⏭️  Skipped {len(skipped_columns)} existing columns")
            
            return True
            
    except Exception as e:
        print(f"\n❌ Error extending candidate table: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🔧 Candidate Model Extension Script")
    print("=" * 50)
    
    success = extend_candidate_table()
    
    if success:
        print("\n✅ Candidate model extended successfully!")
        print("   Next: Update backend/main.py CandidateDB class with new fields")
        sys.exit(0)
    else:
        print("\n⚠️  Some columns may not have been added")
        sys.exit(1)

