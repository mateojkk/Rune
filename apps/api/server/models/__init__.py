from pydantic import BaseModel
from typing import Any, Optional


class StoreRequest(BaseModel):
    data: Any
    epochs: int = 2


class EncryptRequest(BaseModel):
    data: Any


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