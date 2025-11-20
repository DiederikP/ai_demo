#!/usr/bin/env python3
"""
Migration script to add personal_criteria column to personas table.

This script should be run once on the Render PostgreSQL database to add the
missing personal_criteria column.

Usage:
    # Set your Render DATABASE_URL as environment variable
    export DATABASE_URL="postgresql://user:pass@host:port/dbname"
    python add_personal_criteria_column.py

Or run with:
    DATABASE_URL="your_render_db_url" python add_personal_criteria_column.py
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
        print("3. Copy the 'Internal Database URL' or 'External Database URL'")
        print("\nThen run:")
        print('  export DATABASE_URL="postgresql://user:pass@host:port/dbname"')
        print("  python add_personal_criteria_column.py")
        print("\nOr run directly:")
        print('  DATABASE_URL="your_url" python add_personal_criteria_column.py')
        sys.exit(1)
    
    return db_url

def column_exists(engine, table_name, column_name):
    """Check if a column exists in a table"""
    inspector = inspect(engine)
    columns = inspector.get_columns(table_name)
    return any(col['name'] == column_name for col in columns)

def main():
    print("🔄 Adding personal_criteria column to personas table")
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
        print("\nMake sure:")
        print("1. DATABASE_URL is correct")
        print("2. Your IP is whitelisted (if using External URL)")
        print("3. Database is running on Render")
        sys.exit(1)
    
    # Check if column already exists
    print("\n🔍 Checking if personal_criteria column exists...")
    if column_exists(engine, 'personas', 'personal_criteria'):
        print("✅ Column 'personal_criteria' already exists in personas table")
        print("   No migration needed!")
        sys.exit(0)
    
    print("❌ Column 'personal_criteria' does NOT exist")
    print("\n🔧 Adding column...")
    
    # Add the column
    try:
        with engine.begin() as connection:
            # Add personal_criteria column as TEXT, nullable
            connection.execute(text("""
                ALTER TABLE personas 
                ADD COLUMN IF NOT EXISTS personal_criteria TEXT
            """))
            print("✅ Successfully added 'personal_criteria' column to personas table")
    except Exception as e:
        print(f"❌ Error adding column: {e}")
        sys.exit(1)
    
    # Verify the column was added
    if column_exists(engine, 'personas', 'personal_criteria'):
        print("✅ Verification: Column 'personal_criteria' now exists!")
        print("\n💡 Tip: Restart your Render backend service to see the changes")
    else:
        print("❌ Verification failed: Column was not added")
        sys.exit(1)

if __name__ == "__main__":
    main()

