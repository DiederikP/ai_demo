#!/usr/bin/env python3
"""
Script to sync local SQLite database to Render PostgreSQL database.

Usage:
    # Set your Render DATABASE_URL as environment variable
    export DATABASE_URL="postgresql://user:pass@host:port/dbname"
    python sync_to_render_db.py

Or run with:
    DATABASE_URL="your_render_db_url" python sync_to_render_db.py
"""

import os
import sys
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
import sqlite3
from datetime import datetime

# Local SQLite database path
LOCAL_DB_PATH = os.path.join(os.path.dirname(__file__), 'ai_hiring.db')

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
        print("  python sync_to_render_db.py")
        print("\nOr run directly:")
        print('  DATABASE_URL="your_url" python sync_to_render_db.py')
        sys.exit(1)
    
    return db_url

def get_table_names(engine):
    """Get all table names from database"""
    inspector = inspect(engine)
    return inspector.get_table_names()

def sync_table_data(local_conn, render_session, table_name):
    """Sync data from SQLite to PostgreSQL for a specific table"""
    print(f"\n📦 Syncing table: {table_name}")
    
    # Get all data from local SQLite
    cursor = local_conn.cursor()
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()
    
    if not rows:
        print(f"   ⚠️  No data in local {table_name} table")
        return 0
    
    # Get column names
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [col[1] for col in cursor.fetchall()]
    
    print(f"   Found {len(rows)} rows in local database")
    
    # Clear existing data in Render database (optional - comment out if you want to keep existing data)
    try:
        render_session.execute(f"TRUNCATE TABLE {table_name} CASCADE")
        render_session.commit()
        print(f"   🗑️  Cleared existing data in Render database")
    except Exception as e:
        print(f"   ⚠️  Could not clear existing data: {e}")
        render_session.rollback()
    
    # Insert data
    inserted = 0
    for row in rows:
        try:
            # Build insert statement
            values = dict(zip(columns, row))
            
            # Handle None values and convert types
            placeholders = ', '.join([f":{col}" for col in columns])
            columns_str = ', '.join(columns)
            
            # Convert row to dict with proper handling
            row_dict = {}
            for i, col in enumerate(columns):
                val = row[i]
                # Handle datetime strings
                if isinstance(val, str) and 'T' in val:
                    try:
                        val = datetime.fromisoformat(val.replace('Z', '+00:00'))
                    except:
                        pass
                row_dict[col] = val
            
            # Insert using raw SQL
            insert_sql = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})"
            render_session.execute(insert_sql, row_dict)
            inserted += 1
        except Exception as e:
            print(f"   ⚠️  Error inserting row: {e}")
            render_session.rollback()
            continue
    
    render_session.commit()
    print(f"   ✅ Inserted {inserted}/{len(rows)} rows successfully")
    return inserted

def main():
    print("🔄 Syncing Local SQLite Database to Render PostgreSQL")
    print("=" * 60)
    
    # Check local database exists
    if not os.path.exists(LOCAL_DB_PATH):
        print(f"❌ Local database not found at: {LOCAL_DB_PATH}")
        sys.exit(1)
    
    # Get Render database URL
    render_db_url = get_render_db_url()
    
    print(f"\n📁 Local Database: {LOCAL_DB_PATH}")
    print(f"🌐 Render Database: {render_db_url.split('@')[1] if '@' in render_db_url else 'Connected'}")
    
    # Connect to local SQLite
    print("\n🔌 Connecting to local SQLite database...")
    local_conn = sqlite3.connect(LOCAL_DB_PATH)
    
    # Connect to Render PostgreSQL
    print("🔌 Connecting to Render PostgreSQL database...")
    try:
        render_engine = create_engine(render_db_url, pool_pre_ping=True)
        render_engine.connect()
        print("✅ Connected to Render database")
    except Exception as e:
        print(f"❌ Failed to connect to Render database: {e}")
        print("\nMake sure:")
        print("1. DATABASE_URL is correct")
        print("2. Your IP is whitelisted (if using External URL)")
        print("3. Database is running on Render")
        sys.exit(1)
    
    # Get table names
    local_cursor = local_conn.cursor()
    local_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    local_tables = [row[0] for row in local_cursor.fetchall()]
    
    render_tables = get_table_names(render_engine)
    
    print(f"\n📊 Found {len(local_tables)} tables in local database")
    print(f"📊 Found {len(render_tables)} tables in Render database")
    
    # Tables to sync (common tables)
    tables_to_sync = [
        'personas',
        'job_postings', 
        'candidates',
        'evaluation_results',
        'candidate_conversations',
        'evaluation_templates',
        'comments',
        'notifications',
        'users',
        'companies',
        'approvals',
        'job_watchers'
    ]
    
    # Filter to only tables that exist in both databases
    tables_to_sync = [t for t in tables_to_sync if t in local_tables and t in render_tables]
    
    if not tables_to_sync:
        print("\n⚠️  No common tables found to sync")
        sys.exit(1)
    
    print(f"\n🔄 Will sync {len(tables_to_sync)} tables:")
    for table in tables_to_sync:
        print(f"   - {table}")
    
    # Confirm
    response = input("\n⚠️  This will REPLACE all data in Render database. Continue? (yes/no): ")
    if response.lower() != 'yes':
        print("❌ Cancelled")
        sys.exit(0)
    
    # Create session for Render
    RenderSession = sessionmaker(bind=render_engine)
    render_session = RenderSession()
    
    # Sync each table
    total_synced = 0
    for table in tables_to_sync:
        try:
            count = sync_table_data(local_conn, render_session, table)
            total_synced += count
        except Exception as e:
            print(f"❌ Error syncing {table}: {e}")
            render_session.rollback()
    
    # Close connections
    local_conn.close()
    render_session.close()
    
    print("\n" + "=" * 60)
    print(f"✅ Sync complete! Synced {total_synced} total rows")
    print("\n💡 Tip: Restart your Render backend service to see the changes")

if __name__ == "__main__":
    main()

