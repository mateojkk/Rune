import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from server.database import engine, Base
from sqlalchemy import text, inspect

def run():
    inspector = inspect(engine)
    columns = [c["name"] for c in inspector.get_columns("forms")]

    if "publish_id" not in columns:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE forms ADD COLUMN publish_id VARCHAR(32)"))
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX ix_forms_publish_id ON forms (publish_id)"
                    " WHERE publish_id IS NOT NULL"
                )
            )
            conn.commit()
        print("Added publish_id column to forms table.")
    else:
        print("publish_id column already exists. Skipping.")


if __name__ == "__main__":
    run()
