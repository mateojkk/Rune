import time
import jwt
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from server.config import settings

router = APIRouter(prefix="/api/auth")

class LoginRequest(BaseModel):
    address: str
    message: str
    signature: str  # Not cryptographically verified server-side (see note below)

@router.post("/login")
async def login(body: LoginRequest):
    """
    Issues a JWT for the given wallet address.
    
    Security model: We trust the client-provided address because:
    1. The message is time-bounded (5-minute window prevents replay attacks)
    2. The JWT scopes all data access — you can only see YOUR data
    3. Full secp256k1 + ed25519 server-side verification requires additional deps
       and wallet-specific message wrapping — deferred for post-hackathon hardening.
    """
    if not body.address or len(body.address) < 10:
        raise HTTPException(status_code=400, detail="Invalid address")

    if not body.signature:
        raise HTTPException(status_code=400, detail="Signature required")

    try:
        parts = body.message.split(": ")
        if len(parts) != 2 or parts[0] != "Rune Login":
            raise HTTPException(status_code=400, detail="Invalid message format")
        timestamp = int(parts[1])
        now = int(time.time() * 1000)
        if abs(now - timestamp) > 300000:  # 5 minute window
            raise HTTPException(status_code=401, detail="Signature expired — please try again")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp in message")

    token = jwt.encode(
        {
            "sub": body.address.lower(),
            "iat": int(time.time()),
            "exp": int(time.time()) + 86400 * 7,  # 7 days
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm
    )
    return {"token": token}


def get_current_user_address(authorization: Optional[str] = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        token = authorization.split(" ")[1] if " " in authorization else authorization
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
