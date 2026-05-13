from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from server.config import DATABASE_URL as CFG_DATABASE_URL

if CFG_DATABASE_URL:
    engine = create_engine(CFG_DATABASE_URL)
else:
    engine = create_engine("sqlite:////tmp/rune.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


def init_db():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        import sys
        print(f"WARNING: DB init failed: {e}", file=sys.stderr)
