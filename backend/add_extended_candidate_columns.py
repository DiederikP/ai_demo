#!/usr/bin/env python3
"""
Migration script to add extended candidate fields to candidates table.

This script adds all the extended candidate fields:
- motivation_reason
- test_results
- age
- years_experience
- skill_tags
- prior_job_titles
- certifications
- education_level
- location
- communication_level
- availability_per_week
- notice_period
- salary_expectation
- source

Usage:
    export DATABASE_URL="postgresql://user:pass@host:port/dbname"
    python add_extended_candidate_columns.py
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect

def get_render_db_url():
    """Get Render database URL from environment"""
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("❌ DATABASE_URL environment variable not set.")
        sys.exit(1)
    
    return db_url

def column_exists(engine, table_name, column_name):
    """Check if a column exists in a table"""
    inspector = inspect(engine)
    try:
        columns = inspector.get_columns(table_name)
        return any(col['name'] == column_name for col in columns)
    except Exception as e:
        print(f"⚠️  Error checking columns: {e}")
        return False

def main():
    print("🔄 Adding extended candidate columns to candidates table")
    print("=" * 60)
    
    render_db_url = get_render_db_url()
    
    print(f"🌐 Connecting to Render Database...")
    
    try:
        engine = create_engine(render_db_url, pool_pre_ping=True)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("✅ Connected to Render database")
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        sys.exit(1)
    
    # Extended candidate fields to add
    columns_to_add = [
        ('motivation_reason', 'TEXT'),
        ('test_results', 'TEXT'),
        ('age', 'INTEGER'),
        ('years_experience', 'INTEGER'),
        ('skill_tags', 'TEXT'),
        ('prior_job_titles', 'TEXT'),
        ('certifications', 'TEXT'),
        ('education_level', 'VARCHAR'),
        ('location', 'VARCHAR'),
        ('communication_level', 'VARCHAR'),
        ('availability_per_week', 'INTEGER'),
        ('notice_period', 'VARCHAR'),
        ('salary_expectation', 'INTEGER'),
        ('source', 'VARCHAR'),
    ]
    
    added_count = 0
    skipped_count = 0
    
    print("\n🔍 Checking existing columns...")
    
    with engine.begin() as connection:
        for col_name, col_type in columns_to_add:
            if column_exists(engine, 'candidates', col_name):
                print(f"  ✅ {col_name:25} : already exists")
                skipped_count += 1
            else:
                print(f"  ❌ {col_name:25} : missing, adding...")
                try:
                    connection.execute(text(f"""
                        ALTER TABLE candidates 
                        ADD COLUMN IF NOT EXISTS {col_name} {col_type}
                    """))
                    print(f"     ✅ Added {col_name}")
                    added_count += 1
                except Exception as e:
                    print(f"     ❌ Error adding {col_name}: {e}")
    
    print("\n" + "=" * 60)
    print(f"✅ Migration complete!")
    print(f"   - Added: {added_count} columns")
    print(f"   - Skipped: {skipped_count} columns (already exist)")
    
    # Verify all columns exist
    print("\n🔍 Final verification...")
    all_exist = all(column_exists(engine, 'candidates', col[0]) for col in columns_to_add)
    
    if all_exist:
        print("✅ All extended candidate columns verified!")
        print("\n💡 Tip: Restart your Render backend service to see the changes")
    else:
        print("⚠️  Some columns might still be missing. Check the errors above.")

if __name__ == "__main__":
    main()

