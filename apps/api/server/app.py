from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from server.config import API_HOST, API_PORT, get_network, is_mainnet, get_settings
from server.models import HealthResponse, StoreRequest, EncryptRequest, DecryptRequest, ZkProofRequest
from server.handlers import store_blob, read_blob, encrypt, decrypt

app = FastAPI(title="Rune Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/config")
def public_config():
    return get_settings().get_public_config()


@app.get("/api/health", response_model=HealthResponse)
def health():
    from server.handlers.walrus import walrus_available as walrus
    from server.handlers.seal import seal_available as seal
    return HealthResponse(status="ok", walrus=walrus, seal=seal)


@app.get("/api/network")
def network_info():
    return {
        "network": get_network(),
        "mainnet": is_mainnet(),
    }


@app.post("/api/walrus/store")
def walrus_store(request: StoreRequest):
    try:
        return store_blob(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/walrus/read/{blob_id}")
def walrus_read(blob_id: str):
    try:
        return read_blob(blob_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/seal/encrypt")
def seal_encrypt(request: EncryptRequest):
    try:
        return encrypt(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/seal/decrypt")
def seal_decrypt(request: DecryptRequest):
    try:
        return decrypt(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/zklogin/prove")
def zk_proof(request: ZkProofRequest):
    try:
        import hashlib
        import json
        
        nonce_inputs = f"{request.ephemeral_public_key}:{request.max_epoch}:{request.jwt_randomness}"
        nonce_hash = hashlib.sha256(nonce_inputs.encode()).hexdigest()[:40]
        
        addr_seed = f"{request.sub}:{request.user_salt}:{request.kc_name}"
        addr_seed_hash = hashlib.sha256(addr_seed.encode()).hexdigest()
        
        proof = {
            "proof": {
                "a": [nonce_hash[:20], nonce_hash[20:40]],
                "b": [[addr_seed_hash[:16], addr_seed_hash[16:32]]],
                "c": [addr_seed_hash[32:48], addr_seed_hash[48:64]],
            },
            "commitment": addr_seed_hash[:64],
            "nonce": nonce_hash,
            "address_seed": addr_seed_hash[:64],
        }
        
        return {
            "proof": proof,
            "network": get_network(),
            "max_epoch": request.max_epoch,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=API_HOST, port=API_PORT)