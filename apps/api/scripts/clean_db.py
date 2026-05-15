import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "apps" / "api"))
from server.database import engine
from sqlalchemy import text

with engine.begin() as conn:
    print("Deleting submissions without valid forms...")
    conn.execute(text("DELETE FROM submissions WHERE form_uuid NOT IN (SELECT uuid FROM forms)"))
    print("Deleting forms without valid workspaces...")
    conn.execute(text("DELETE FROM forms WHERE workspace_uuid NOT IN (SELECT uuid FROM workspaces)"))
    print("Deleting forms without valid users...")
    conn.execute(text("DELETE FROM forms WHERE user_address NOT IN (SELECT address FROM users)"))
    print("Deleting workspaces without valid users...")
    conn.execute(text("DELETE FROM workspaces WHERE user_address NOT IN (SELECT address FROM users)"))
    print("Cleanup complete.")
