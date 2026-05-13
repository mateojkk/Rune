from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from server.config import API_HOST, API_PORT, get_network, is_mainnet, get_settings
from server.models import ZkProofRequest
from server.handlers.data import router as data_router
from server.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Rune Backend API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data_router)


@app.get("/api/config")
def public_config():
    return get_settings().get_public_config()


@app.get("/api/health")
def health():
    return {"status": "ok", "walrus": False, "seal": False}


@app.get("/api/network")
def network_info():
    return {
        "network": get_network(),
        "mainnet": is_mainnet(),
    }


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
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=API_HOST, port=API_PORT)
