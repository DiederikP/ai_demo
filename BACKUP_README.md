# Backup Instructions

## Creating a Backup

To create a full backup of the project, run:

```bash
cd /Users/diederikpondman/Documents/ai_demo
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="../backups/$BACKUP_NAME"
mkdir -p "$BACKUP_DIR"

# Copy all files excluding build artifacts
rsync -av \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.env.local' \
  --exclude='.env' \
  . "$BACKUP_DIR/"

echo "Backup created: $BACKUP_DIR"
```

## Restoring from Backup

To restore from a backup:

```bash
# 1. Navigate to project directory
cd /Users/diederikpondman/Documents/ai_demo

# 2. Copy backup files back
BACKUP_DIR="../backups/backup_YYYYMMDD_HHMMSS"
rsync -av "$BACKUP_DIR/" .

# 3. Reinstall dependencies
cd backend && source venv/bin/activate && pip install -r requirements.txt
cd ../frontend && npm install
```

## What's Included in Backup

- ✅ All source code (frontend/src, backend/)
- ✅ Configuration files (package.json, requirements.txt, etc.)
- ✅ Database files (backend/*.db)
- ✅ Documentation files
- ✅ Static assets

## What's Excluded

- ❌ node_modules (can be reinstalled)
- ❌ .next build cache (can be regenerated)
- ❌ venv (can be recreated)
- ❌ __pycache__ (can be regenerated)
- ❌ .git (version control)
- ❌ .env files (sensitive data - backup separately if needed)
- ❌ Log files

## Backup Locations

Backups are stored in: `/Users/diederikpondman/Documents/backups/`

Each backup is named: `backup_YYYYMMDD_HHMMSS`



