import uuid
import secrets
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, JSON, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from server.database import Base


def _uuid():
    return str(uuid.uuid4())


def _publish_id():
    return secrets.token_urlsafe(8)


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    address = Column(String(128), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=True)
    pfp = Column(Text, nullable=True)
    theme = Column(String(20), default="light")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    workspaces = relationship("Workspace", back_populates="user", cascade="all, delete-orphan")
    forms = relationship("Form", back_populates="user", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False, default=_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    user_address = Column(String(128), ForeignKey("users.address", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user = relationship("User", back_populates="workspaces")
    forms = relationship("Form", back_populates="workspace", cascade="all, delete-orphan")


class Form(Base):
    __tablename__ = "forms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False, default=_uuid)
    title = Column(String(255), nullable=False, default="")
    description = Column(Text, default="")
    workspace_uuid = Column(String(36), ForeignKey("workspaces.uuid", ondelete="CASCADE"), nullable=False, index=True)
    user_address = Column(String(128), ForeignKey("users.address", ondelete="CASCADE"), nullable=False, index=True)
    fields = Column(JSON, default=list)
    blob_id = Column(String(255), nullable=True)
    profile_picture = Column(Text, nullable=True)
    cover_picture = Column(Text, nullable=True)
    is_published = Column(Boolean, default=False)
    publish_id = Column(String(32), unique=True, nullable=True, default=None)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    workspace = relationship("Workspace", back_populates="forms")
    user = relationship("User", back_populates="forms")
    submissions = relationship("Submission", back_populates="form", cascade="all, delete-orphan")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, nullable=False, default=_uuid)
    form_uuid = Column(String(36), ForeignKey("forms.uuid", ondelete="CASCADE"), nullable=False, index=True)
    data = Column(JSON, default=dict)
    wallet_address = Column(String(128), nullable=True)
    submitted_at = Column(DateTime, default=_now)
    blob_id = Column(String(255), nullable=True)

    form = relationship("Form", back_populates="submissions")
