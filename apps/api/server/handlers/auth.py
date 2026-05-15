import base64
import time
import jwt
import nacl.signing
import nacl.exceptions
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from server.config import settings

router = APIRouter(prefix="/api/auth")

class LoginRequest(BaseModel):
    address: str
    message: str
    signature: str # Base64 serialized signature: flag || sig || pk

def verify_sui_signature(address: str, message: str, signature_b64: str) -> bool:
    try:
        sig_bytes = base64.b64decode(signature_b64)
        if len(sig_bytes) < 33:
            return False
            
        flag = sig_bytes[0]
        if flag != 0: # Only supporting Ed25519 for now
            return False
            
        # Sui Ed25519 signature: [0] flag, [1:65] sig, [65:] pk
        signature = sig_bytes[1:65]
        pubkey_bytes = sig_bytes[65:]
        
        # Verify message. Sui PersonalMessage wrapping:
        # b'\x03\x00\x00' + len(message_bytes) + message_bytes
        message_bytes = message.encode('utf-8')
        
        # Simple length encoding for short messages
        if len(message_bytes) < 128:
            wrapped = b'\x03\x00\x00' + bytes([len(message_bytes)]) + message_bytes
        else:
            # For longer messages Sui uses VLQ, but for "Login to Rune" it's short
            wrapped = b'\x03\x00\x00' + len(message_bytes).to_bytes(2, 'big') + message_bytes

        verify_key = nacl.signing.VerifyKey(pubkey_bytes)
        verify_key.verify(wrapped, signature)
        return True
    except Exception as e:
        print(f"Signature verification error: {e}")
        return False

@router.post("/login")
async def login(body: LoginRequest):
    # 1. Verify signature
    if not verify_sui_signature(body.address, body.message, body.signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
        
    # 2. Check message content (e.g. "Rune Login: <timestamp>")
    try:
        parts = body.message.split(": ")
        if len(parts) != 2 or parts[0] != "Rune Login":
            raise HTTPException(status_code=400, detail="Invalid message format")
            
        timestamp = int(parts[1])
        now = int(time.time() * 1000)
        if abs(now - timestamp) > 300000: # 5 minute window
            raise HTTPException(status_code=401, detail="Signature expired")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp")

    # 3. Issue JWT
    token = jwt.encode(
        {"sub": body.address.lower(), "iat": int(time.time()), "exp": int(time.time()) + 86400 * 7},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm
    )
    
    return {"token": token}

def get_current_user_address(authorization: Optional[str] = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
        
    try:
        token = authorization.split(" ")[1] if " " in authorization else authorization
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
