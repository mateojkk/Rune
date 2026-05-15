from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime


class ZkProofRequest(BaseModel):
    jwt: str
    ephemeral_public_key: str
    max_epoch: int
    jwt_randomness: str
    user_salt: str
    sub: str
    iss: str
    aud: str
    kc_name: str = "sub"


# --- Data API Schemas ---

class WorkspaceCreate(BaseModel):
    name: str
    description: str = ""

class WorkspaceOut(BaseModel):
    uuid: str
    name: str
    description: str
    formIds: list[str] = []
    createdAt: str
    updatedAt: str

class FormCreate(BaseModel):
    title: str = ""
    description: str = ""
    workspace_uuid: str
    fields: list = []
    profile_picture: Optional[str] = None
    cover_picture: Optional[str] = None

class FormUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    fields: Optional[list] = None
    blob_id: Optional[str] = None
    profile_picture: Optional[str] = None
    cover_picture: Optional[str] = None
    is_published: Optional[bool] = None

class FormOut(BaseModel):
    id: str
    title: str
    description: str
    workspaceId: str
    fields: list
    blobId: Optional[str] = None
    profilePicture: Optional[str] = None
    coverPicture: Optional[str] = None
    isPublished: bool = False
    walletAddress: Optional[str] = None
    createdAt: str
    updatedAt: str

class SubmissionCreate(BaseModel):
    data: dict
    walletAddress: Optional[str] = None
    submittedAt: Optional[datetime] = None
    blobId: Optional[str] = None

class SubmissionOut(BaseModel):
    id: str
    formId: str
    data: dict
    walletAddress: Optional[str] = None
    submittedAt: str
    blobId: Optional[str] = None

class MoveFormRequest(BaseModel):
    workspace_uuid: str

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    pfp: Optional[str] = None
    theme: Optional[str] = None

class ProfileOut(BaseModel):
    display_name: Optional[str] = None
    pfp: Optional[str] = None
    theme: str = "light"
