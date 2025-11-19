# Sync Local Database to Render PostgreSQL

## Overview
This guide shows you how to sync your local SQLite database (`backend/ai_hiring.db`) to your Render PostgreSQL database.

## Prerequisites
1. Your Render database is set up and running
2. You have the Render database connection URL
3. Python 3.11+ installed locally

## Step 1: Get Your Render Database URL

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on your **PostgreSQL database** (or the database linked to your backend)
3. Go to the **"Connections"** tab
4. Copy one of these URLs:
   - **Internal Database URL** (if running script from Render)
   - **External Database URL** (if running script from your local machine)
   
   Format: `postgresql://user:password@host:port/dbname`

## Step 2: Run the Sync Script

### Option A: Using Environment Variable (Recommended)

```bash
cd backend
export DATABASE_URL="postgresql://user:password@host:port/dbname"
python sync_to_render_db.py
```

### Option B: Inline Environment Variable

```bash
cd backend
DATABASE_URL="postgresql://user:password@host:port/dbname" python sync_to_render_db.py
```

### Option C: Create .env file (for repeated use)

1. Create `backend/.env` file:
   ```env
   DATABASE_URL=postgresql://user:password@host:port/dbname
   ```

2. Run:
   ```bash
   cd backend
   python sync_to_render_db.py
   ```

## Step 3: Confirm Sync

The script will:
1. ✅ Connect to both databases
2. 📊 Show tables to sync
3. ⚠️  Ask for confirmation (type `yes` to continue)
4. 🔄 Sync all data from local to Render
5. ✅ Show summary

## What Gets Synced

The script syncs these tables:
- `personas` (Digitale Werknemers)
- `job_postings` (Vacatures)
- `candidates` (Kandidaten)
- `evaluation_results` (Evaluatie resultaten)
- `candidate_conversations` (Gesprekken)
- `evaluation_templates` (Templates)
- `comments` (Commentaren)
- `notifications` (Notificaties)
- `users` (Gebruikers)
- `companies` (Bedrijven)
- `approvals` (Goedkeuringen)
- `job_watchers` (Job watchers)

## Important Notes

⚠️ **Warning**: The script will **REPLACE** all existing data in the Render database with your local data.

- Make a backup of your Render database first if you have important data there
- The script clears existing data before inserting new data
- All local data will be copied to Render

## Troubleshooting

### "Failed to connect to Render database"
- Check that DATABASE_URL is correct
- If using External URL, make sure your IP is whitelisted
- Verify database is running on Render

### "No common tables found"
- Make sure both databases have the same table structure
- Run `create_missing_tables.py` on Render first if needed

### Connection Timeout
- Use Internal Database URL if running from Render
- Check firewall/network settings
- Verify database is accessible

## After Syncing

1. **Restart your Render backend service** to see the changes
2. **Verify data** by checking your frontend
3. **Test** by logging in and viewing your data

## Alternative: Manual Export/Import

If the script doesn't work, you can:

1. **Export from SQLite:**
   ```bash
   sqlite3 backend/ai_hiring.db .dump > backup.sql
   ```

2. **Import to PostgreSQL** (requires psql):
   ```bash
   psql $DATABASE_URL < backup.sql
   ```

## Need Help?

Check the script output for detailed error messages. Common issues:
- Database URL format incorrect
- Network/firewall blocking connection
- Table structure mismatch
- Permission issues

