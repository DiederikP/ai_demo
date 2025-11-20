#!/usr/bin/env python3
"""
Migration script to add submitted_by_company_id column to candidates table.

Usage:
    export DATABASE_URL="postgresql://user:pass@host:port/dbname"
    python add_submitted_by_company_id_column.py
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
    print("🔄 Adding submitted_by_company_id column to candidates table")
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
    
    print("\n🔍 Checking if submitted_by_company_id column exists...")
    
    if column_exists(engine, 'candidates', 'submitted_by_company_id'):
        print("✅ Column 'submitted_by_company_id' already exists")
        sys.exit(0)
    
    print("❌ Column 'submitted_by_company_id' does NOT exist")
    print("\n🔧 Adding column...")
    
    try:
        with engine.begin() as connection:
            # Add submitted_by_company_id column as VARCHAR, nullable
            connection.execute(text("""
                ALTER TABLE candidates 
                ADD COLUMN IF NOT EXISTS submitted_by_company_id VARCHAR
            """))
            print("✅ Successfully added 'submitted_by_company_id' column")
    except Exception as e:
        print(f"❌ Error adding column: {e}")
        sys.exit(1)
    
    # Verify
    if column_exists(engine, 'candidates', 'submitted_by_company_id'):
        print("✅ Verification: Column 'submitted_by_company_id' now exists!")
        print("\n💡 Tip: Legacy candidates will have NULL for this column")
    else:
        print("❌ Verification failed")
        sys.exit(1)

if __name__ == "__main__":
    main()

