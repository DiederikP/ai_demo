#!/usr/bin/env python3
"""
Database Schema Verification Script
Checks if all required tables and columns exist in the database.
Run this to verify the database schema matches the application requirements.
"""

import sys
import os
from sqlalchemy import inspect as sqlalchemy_inspect, create_engine, text
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import (
    Base, engine, SessionLocal,
    JobPostingDB, CandidateDB, CandidateConversationDB, EvaluationDB,
    EvaluationResultDB, PersonaDB, EvaluationTemplateDB, EvaluationHandlerDB,
    CompanyDB, UserDB, NotificationDB, CommentDB, JobWatcherDB,
    CandidateWatcherDB, ApprovalDB, ScheduledAppointmentDB
)

def get_expected_schema():
    """Get expected schema from SQLAlchemy models"""
    expected = {}
    
    # Get all tables from Base metadata
    for table_name, table in Base.metadata.tables.items():
        expected[table_name] = {
            'columns': {col.name: str(col.type) for col in table.columns},
            'primary_keys': [col.name for col in table.columns if col.primary_key],
            'foreign_keys': [fk.name if hasattr(fk, 'name') else str(fk) for fk in table.foreign_keys]
        }
    
    return expected

def get_actual_schema():
    """Get actual schema from database"""
    inspector = sqlalchemy_inspect(engine)
    actual = {}
    
    try:
        table_names = inspector.get_table_names()
        for table_name in table_names:
            columns = {}
            for col in inspector.get_columns(table_name):
                columns[col['name']] = str(col['type'])
            
            pk_constraint = inspector.get_pk_constraint(table_name)
            actual[table_name] = {
                'columns': columns,
                'primary_keys': pk_constraint.get('constrained_columns', []) if pk_constraint else [],
                'foreign_keys': [fk.get('name', str(fk)) for fk in inspector.get_foreign_keys(table_name)]
            }
    except Exception as e:
        print(f"Error inspecting database: {e}")
        return None
    
    return actual

def compare_schemas(expected, actual):
    """Compare expected and actual schemas"""
    issues = []
    warnings = []
    
    if actual is None:
        return ["ERROR: Could not inspect database"], []
    
    # Check for missing tables
    expected_tables = set(expected.keys())
    actual_tables = set(actual.keys())
    missing_tables = expected_tables - actual_tables
    extra_tables = actual_tables - expected_tables
    
    if missing_tables:
        issues.append(f"Missing tables: {', '.join(missing_tables)}")
    
    if extra_tables:
        warnings.append(f"Extra tables (not in models): {', '.join(extra_tables)}")
    
    # Check each table
    for table_name in expected_tables & actual_tables:
        expected_cols = set(expected[table_name]['columns'].keys())
        actual_cols = set(actual[table_name]['columns'].keys())
        
        missing_cols = expected_cols - actual_cols
        extra_cols = actual_cols - expected_cols
        
        if missing_cols:
            issues.append(f"Table '{table_name}' missing columns: {', '.join(missing_cols)}")
        
        if extra_cols:
            warnings.append(f"Table '{table_name}' has extra columns: {', '.join(extra_cols)}")
        
        # Check column types (basic check)
        for col_name in expected_cols & actual_cols:
            expected_type = expected[table_name]['columns'][col_name].lower()
            actual_type = actual[table_name]['columns'][col_name].lower()
            
            # Basic type compatibility check (not strict, just warnings)
            if 'text' in expected_type and 'varchar' not in actual_type and 'text' not in actual_type:
                warnings.append(f"Table '{table_name}' column '{col_name}': expected TEXT-like, got {actual_type}")
            elif 'integer' in expected_type and 'int' not in actual_type:
                warnings.append(f"Table '{table_name}' column '{col_name}': expected INTEGER-like, got {actual_type}")
            elif 'boolean' in expected_type and 'bool' not in actual_type:
                warnings.append(f"Table '{table_name}' column '{col_name}': expected BOOLEAN-like, got {actual_type}")
    
    return issues, warnings

def main():
    print("=" * 80)
    print("DATABASE SCHEMA VERIFICATION")
    print("=" * 80)
    print()
    
    print("1. Getting expected schema from SQLAlchemy models...")
    expected = get_expected_schema()
    print(f"   ✓ Found {len(expected)} expected tables")
    for table_name in sorted(expected.keys()):
        print(f"      - {table_name} ({len(expected[table_name]['columns'])} columns)")
    print()
    
    print("2. Getting actual schema from database...")
    actual = get_actual_schema()
    if actual:
        print(f"   ✓ Found {len(actual)} actual tables")
        for table_name in sorted(actual.keys()):
            print(f"      - {table_name} ({len(actual[table_name]['columns'])} columns)")
    else:
        print("   ✗ Could not inspect database")
    print()
    
    print("3. Comparing schemas...")
    issues, warnings = compare_schemas(expected, actual)
    print()
    
    if issues:
        print("=" * 80)
        print("❌ ISSUES FOUND (must be fixed):")
        print("=" * 80)
        for issue in issues:
            print(f"  - {issue}")
        print()
        return 1
    else:
        print("=" * 80)
        print("✓ NO CRITICAL ISSUES FOUND")
        print("=" * 80)
        print()
    
    if warnings:
        print("=" * 80)
        print("⚠ WARNINGS (may need attention):")
        print("=" * 80)
        for warning in warnings:
            print(f"  - {warning}")
        print()
    
    print("=" * 80)
    print("VERIFICATION COMPLETE")
    print("=" * 80)
    
    return 0 if not issues else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

