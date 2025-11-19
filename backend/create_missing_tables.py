#!/usr/bin/env python3
"""
Create missing database tables for new features
This script adds the new tables without requiring a full backend restart
"""

import sys
import os

# Add parent directory to path to import main
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from main import Base, UserDB, NotificationDB, CommentDB, JobWatcherDB, CandidateWatcherDB

def create_tables():
    """Create all missing tables"""
    try:
        # Use the same database URL as main.py
        DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ai_hiring.db")
        
        if DATABASE_URL.startswith("sqlite"):
            engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
        else:
            engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
        
        # Create all tables
        print("📊 Creating database tables...")
        Base.metadata.create_all(engine)
        
        # Verify tables were created
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        required_tables = ['users', 'notifications', 'comments', 'job_watchers', 'candidate_watchers']
        
        print("\n✅ Tables created:")
        for table in required_tables:
            if table in tables:
                print(f"  ✅ {table}")
            else:
                print(f"  ❌ {table} - FAILED")
        
        # Check if all tables exist
        missing = [t for t in required_tables if t not in tables]
        if missing:
            print(f"\n⚠️  Warning: {len(missing)} table(s) still missing")
            return False
        else:
            print("\n✅ All required tables created successfully!")
            return True
            
    except Exception as e:
        print(f"\n❌ Error creating tables: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🔧 Database Table Creation Script")
    print("=" * 50)
    
    success = create_tables()
    
    if success:
        print("\n✅ Database is ready!")
        print("   You can now run: python3 test_all_features.py")
        sys.exit(0)
    else:
        print("\n⚠️  Some tables may not have been created")
        print("   Try restarting the backend: python main.py")
        sys.exit(1)

