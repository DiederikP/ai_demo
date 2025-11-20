#!/usr/bin/env python3
"""
Migration script to add missing columns to job_postings table.

This script adds:
- is_active (Boolean, default True)
- weighted_requirements (Text, nullable)
- assigned_agency_id (String, nullable, ForeignKey to users.id)
- company_id (String, nullable, ForeignKey to companies.id)

Usage:
    export DATABASE_URL="postgresql://user:pass@host:port/dbname"
    python add_missing_job_postings_columns.py
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect

def get_render_db_url():
    """Get Render database URL from environment or prompt user"""
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("❌ DATABASE_URL environment variable not set.")
        print("\nTo get your Render database URL:")
        print("1. Go to Render Dashboard → Your Database")
        print("2. Go to 'Connections' tab")
        print("3. Copy the 'External Database URL'")
        print("\nThen run:")
        print('  export DATABASE_URL="postgresql://user:pass@host:port/dbname"')
        print("  python add_missing_job_postings_columns.py")
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
    print("🔄 Adding missing columns to job_postings table")
    print("=" * 60)
    
    # Get Render database URL
    render_db_url = get_render_db_url()
    
    print(f"🌐 Connecting to Render Database...")
    
    # Connect to Render PostgreSQL
    try:
        engine = create_engine(render_db_url, pool_pre_ping=True)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("✅ Connected to Render database")
    except Exception as e:
        print(f"❌ Failed to connect to Render database: {e}")
        sys.exit(1)
    
    # Columns to add
    columns_to_add = [
        {
            'name': 'is_active',
            'sql': 'ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE',
            'description': 'Boolean flag for Active/Inactive grouping'
        },
        {
            'name': 'weighted_requirements',
            'sql': 'ADD COLUMN IF NOT EXISTS weighted_requirements TEXT',
            'description': 'JSON string of weighted requirements'
        },
        {
            'name': 'assigned_agency_id',
            'sql': 'ADD COLUMN IF NOT EXISTS assigned_agency_id VARCHAR',
            'description': 'Foreign key to users.id for recruiter assignment'
        },
        {
            'name': 'company_id',
            'sql': 'ADD COLUMN IF NOT EXISTS company_id VARCHAR',
            'description': 'Foreign key to companies.id for portal isolation'
        }
    ]
    
    # Check and add columns
    added_count = 0
    skipped_count = 0
    
    with engine.begin() as connection:
        for col_info in columns_to_add:
            col_name = col_info['name']
            
            print(f"\n🔍 Checking column: {col_name}")
            
            if column_exists(engine, 'job_postings', col_name):
                print(f"   ✅ Column '{col_name}' already exists - skipping")
                skipped_count += 1
            else:
                print(f"   ❌ Column '{col_name}' does NOT exist")
                print(f"   🔧 Adding column...")
                
                try:
                    connection.execute(text(f"""
                        ALTER TABLE job_postings 
                        {col_info['sql']}
                    """))
                    print(f"   ✅ Successfully added '{col_name}' column")
                    added_count += 1
                except Exception as e:
                    print(f"   ❌ Error adding column: {e}")
    
    # Summary
    print("\n" + "=" * 60)
    print(f"✅ Migration complete!")
    print(f"   - Added: {added_count} columns")
    print(f"   - Skipped: {skipped_count} columns (already exist)")
    
    # Verify all columns exist now
    print("\n🔍 Final verification...")
    all_exist = all(column_exists(engine, 'job_postings', col['name']) for col in columns_to_add)
    
    if all_exist:
        print("✅ All columns verified!")
        print("\n💡 Tip: Restart your Render backend service to see the changes")
    else:
        print("⚠️  Some columns might still be missing. Check the errors above.")

if __name__ == "__main__":
    main()

