from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime


class StoreRequest(BaseModel):
    data: Any
    epochs: int = 2


class EncryptRequest(BaseModel):
    data: Any
    threshold: int = 2


class DecryptRequest(BaseModel):
    encryptedBytes: str
    backupKey: Optional[str] = None


class StoreResponse(BaseModel):
    blobId: str
    objectId: str
    newlyCreated: Optional[bool] = None


class HealthResponse(BaseModel):
    status: str
    walrus: bool
    seal: bool


class EncryptResponse(BaseModel):
    encryptedBytes: str
    backupKey: Optional[str] = None
    objectId: str
    threshold: int


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


class ZkProofResponse(BaseModel):
    proof: dict
    network: str
    max_epoch: int


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

class FormOut(BaseModel):
    id: str
    title: str
    description: str
    workspaceId: str
    fields: list
    blobId: Optional[str] = None
    profilePicture: Optional[str] = None
    coverPicture: Optional[str] = None
    createdAt: str
    updatedAt: str

class SubmissionCreate(BaseModel):
    data: dict
    walletAddress: Optional[str] = None

class SubmissionOut(BaseModel):
    id: str
    formId: str
    data: dict
    walletAddress: Optional[str] = None
    submittedAt: str
    blobId: Optional[str] = None

class MoveFormRequest(BaseModel):
    workspace_uuid: str
