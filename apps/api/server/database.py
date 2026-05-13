import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from server.config import DATABASE_URL as CFG_DATABASE_URL

VERCEL = os.environ.get("VERCEL", "").lower() == "1"

if CFG_DATABASE_URL:
    engine = create_engine(CFG_DATABASE_URL)
elif VERCEL:
    engine = create_engine("sqlite:////tmp/rune.db", connect_args={"check_same_thread": False})
else:
    DB_PATH = Path(__file__).parent.parent / "rune.db"
    engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


def init_db():
    Base.metadata.create_all(bind=engine)
