import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "apps" / "api"))
from server.database import engine
from sqlalchemy import text

# Foreign key constraints to add
constraints = [
    """
    ALTER TABLE workspaces
    ADD CONSTRAINT fk_workspaces_users
    FOREIGN KEY (user_address) REFERENCES users (address)
    ON DELETE CASCADE;
    """,
    """
    ALTER TABLE forms
    ADD CONSTRAINT fk_forms_workspaces
    FOREIGN KEY (workspace_uuid) REFERENCES workspaces (uuid)
    ON DELETE CASCADE;
    """,
    """
    ALTER TABLE forms
    ADD CONSTRAINT fk_forms_users
    FOREIGN KEY (user_address) REFERENCES users (address)
    ON DELETE CASCADE;
    """,
    """
    ALTER TABLE submissions
    ADD CONSTRAINT fk_submissions_forms
    FOREIGN KEY (form_uuid) REFERENCES forms (uuid)
    ON DELETE CASCADE;
    """
]

with engine.begin() as conn:
    for sql in constraints:
        try:
            print(f"Executing: {sql.strip()}")
            conn.execute(text(sql))
        except Exception as e:
            print(f"Failed or already exists: {e}")

print("Done applying foreign keys.")
