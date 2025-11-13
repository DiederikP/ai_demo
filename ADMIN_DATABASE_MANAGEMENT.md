# Admin Database Management Interface

## Recommended Approach

For managing the database as an admin, I recommend creating a dedicated admin interface within the company portal. Here are the options:

### Option 1: Admin Module in Company Portal (Recommended)
- Add an "Admin" module to the CompanyNavigation
- Create `/company/admin` page with database management tools
- Features:
  - View all tables (candidates, jobs, personas, evaluation_results)
  - Search and filter capabilities
  - Bulk operations (delete, export)
  - Database statistics dashboard
  - Direct SQL query interface (optional, with safety checks)

### Option 2: Separate Admin Portal
- Create `/admin` route (separate from company portal)
- Requires admin authentication
- Full CRUD operations on all database tables
- Audit logging for admin actions

### Option 3: Database Management Tool Integration
- Use existing tools like:
  - **SQLite Browser** (for local development)
  - **DBeaver** (cross-platform)
  - **TablePlus** (Mac/Windows)
  - **Adminer** (web-based, can be embedded)

## Implementation Recommendation

I recommend **Option 1** - adding an Admin module to the company portal:

1. **Add to CompanyNavigation**: New "Admin" menu item (only visible to admin users)
2. **Create AdminDashboard component** with:
   - Database overview cards (total records per table)
   - Quick actions (cleanup, export, backup)
   - Table browsers with pagination
   - Search and filter functionality
3. **Backend endpoints**:
   - `GET /admin/stats` - Database statistics
   - `GET /admin/tables/{table_name}` - List records with pagination
   - `DELETE /admin/tables/{table_name}/{id}` - Delete record
   - `POST /admin/export` - Export database to JSON/CSV
   - `POST /admin/backup` - Create database backup

## Security Considerations

- Add role-based access control (admin role check)
- Log all admin actions
- Require confirmation for destructive operations
- Rate limiting on admin endpoints
- Audit trail for database changes

Would you like me to implement Option 1 (Admin module in company portal)?

