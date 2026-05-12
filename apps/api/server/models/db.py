import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, JSON, Integer
from server.database import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    address = Column(String(128), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False, default=_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    user_address = Column(String(128), nullable=False, index=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class Form(Base):
    __tablename__ = "forms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False, default=_uuid)
    title = Column(String(255), nullable=False, default="")
    description = Column(Text, default="")
    workspace_uuid = Column(String(36), nullable=False, index=True)
    user_address = Column(String(128), nullable=False, index=True)
    fields = Column(JSON, default=list)
    blob_id = Column(String(255), nullable=True)
    profile_picture = Column(Text, nullable=True)
    cover_picture = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False, default=_uuid)
    form_uuid = Column(String(36), nullable=False, index=True)
    data = Column(JSON, default=dict)
    wallet_address = Column(String(128), nullable=True)
    submitted_at = Column(DateTime, default=_now)
    blob_id = Column(String(255), nullable=True)
