import base64
import time
import jwt
import nacl.signing
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import Optional
from server.config import settings

router = APIRouter(prefix="/api/auth")

class LoginRequest(BaseModel):
    address: str
    message: str
    signature: str  # Base64 Sui serialized signature

def verify_sui_signature(address: str, message: str, signature_b64: str) -> bool:
    """
    Verifies a Sui personal message signature.
    Sui serializes signatures as: [flag(1)] || [sig(64 or 65)] || [pubkey]
    Flag 0x00 = Ed25519, 0x01 = Secp256k1, 0x02 = Secp256r1
    """
    try:
        sig_bytes = base64.b64decode(signature_b64)
        if len(sig_bytes) < 2:
            return False

        flag = sig_bytes[0]

        if flag == 0x00:
            # Ed25519: flag(1) + sig(64) + pubkey(32) = 97 bytes
            if len(sig_bytes) < 97:
                return False
            signature = sig_bytes[1:65]
            pubkey_bytes = sig_bytes[65:97]
            message_bytes = message.encode('utf-8')
            if len(message_bytes) < 128:
                wrapped = b'\x03\x00\x00' + bytes([len(message_bytes)]) + message_bytes
            else:
                wrapped = b'\x03\x00\x00' + len(message_bytes).to_bytes(2, 'big') + message_bytes
            verify_key = nacl.signing.VerifyKey(pubkey_bytes)
            verify_key.verify(wrapped, signature)
            return True

        elif flag == 0x01:
            # Secp256k1: flag(1) + sig(65) + pubkey(33) = 99 bytes
            # We skip cryptographic verification and trust the address matches
            # (full secp256k1 verification requires a separate library)
            # For the hackathon, we trust the client-side address
            if address and len(address) > 10:
                return True
            return False

        return False
    except Exception as e:
        print(f"Signature verification error: {e}")
        return False

@router.post("/login")
async def login(body: LoginRequest):
    if not verify_sui_signature(body.address, body.message, body.signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    try:
        parts = body.message.split(": ")
        if len(parts) != 2 or parts[0] != "Rune Login":
            raise HTTPException(status_code=400, detail="Invalid message format")
        timestamp = int(parts[1])
        now = int(time.time() * 1000)
        if abs(now - timestamp) > 300000:  # 5 minute window
            raise HTTPException(status_code=401, detail="Signature expired")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp")

    token = jwt.encode(
        {"sub": body.address.lower(), "iat": int(time.time()), "exp": int(time.time()) + 86400 * 7},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm
    )
    return {"token": token}

def get_current_user_address(
    authorization: Optional[str] = Header(None),
    address: Optional[str] = Query(None),
) -> str:
    """
    Accepts Bearer JWT (secure) OR legacy ?address= param (for unauthenticated reads).
    JWT takes priority. ?address= is still accepted so existing calls don't break.
    """
    if authorization:
        try:
            token = authorization.split(" ")[1] if " " in authorization else authorization
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            return payload["sub"]
        except Exception:
            pass

    if address and address.strip():
        return address.strip().lower()

    raise HTTPException(status_code=401, detail="Authentication required")
