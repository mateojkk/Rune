from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from server.config import API_HOST, API_PORT, get_network, is_mainnet, get_settings
from server.models import ZkProofRequest
from server.handlers.data import router as data_router
from server.handlers.auth import router as auth_router
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
app.include_router(auth_router)


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
async def zk_proof(request: ZkProofRequest):
    try:
        import httpx
        
        # Determine prover URL based on network
        is_main = is_mainnet()
        prover_url = "https://prover.mystenlabs.com/v1" if is_main else "https://prover-dev.mystenlabs.com/v1"
        
        payload = {
            "jwt": request.jwt,
            "extendedEphemeralPublicKey": request.ephemeral_public_key,
            "maxEpoch": str(request.max_epoch),
            "jwtRandomness": request.jwt_randomness,
            "salt": request.user_salt,
            "keyClaimName": request.kc_name
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(prover_url, json=payload, timeout=30.0)
            
        if response.status_code != 200:
            error_data = response.json()
            raise HTTPException(status_code=response.status_code, detail=f"Prover error: {error_data}")
            
        proof = response.json()

        return {
            "proof": proof,
            "network": get_network(),
            "max_epoch": request.max_epoch,
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=API_HOST, port=API_PORT)
