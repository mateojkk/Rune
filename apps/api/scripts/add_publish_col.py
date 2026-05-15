import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "apps" / "api"))
from server.database import engine
from sqlalchemy import text

with engine.begin() as conn:
    try:
        print("Adding is_published column to forms table...")
        conn.execute(text("ALTER TABLE forms ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE"))
        print("Column added successfully.")
    except Exception as e:
        print(f"Error: {e}")
