from contextlib import asynccontextmanager
import os
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
        
        # Strictly use Mainnet/Testnet prover based on network config
        is_main = is_mainnet()
        settings = get_settings()
        
        if settings.zklogin_prover_url:
            prover_url = settings.zklogin_prover_url
        else:
            prover_url = "https://prover.mystenlabs.com/v1" if is_main else "https://prover-dev.mystenlabs.com/v1"
        
        # Shinami uses JSON-RPC, while Mysten uses a flat REST payload
        is_shinami = "shinami.com" in prover_url
        
        print(f"DEBUG: Using network {get_network()}. Calling prover: {prover_url} (Shinami mode: {is_shinami})")
        
        if is_shinami:
            # Shinami JSON-RPC format: shinami_zkp_createZkLoginProof
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "shinami_zkp_createZkLoginProof",
                "params": [
                    request.jwt,
                    request.ephemeral_public_key,
                    int(request.max_epoch),
                    request.jwt_randomness,
                    request.user_salt
                ]
            }
        else:
            # Standard Mysten REST format
            payload = {
                "jwt": request.jwt,
                "extendedEphemeralPublicKey": request.ephemeral_public_key,
                "maxEpoch": int(request.max_epoch),
                "jwtRandomness": request.jwt_randomness,
                "salt": request.user_salt,
                "sub": request.sub,
                "iss": request.iss,
                "aud": request.aud,
                "keyClaimName": request.kc_name
            }
        
        headers = {"Content-Type": "application/json"}
        if settings.zklogin_prover_api_key:
            print(f"DEBUG: API Key detected (length: {len(settings.zklogin_prover_api_key)})")
            headers["X-API-Key"] = settings.zklogin_prover_api_key
        else:
            print("DEBUG: No API Key detected in settings")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(prover_url, json=payload, headers=headers, timeout=30.0)
            
        if response.status_code != 200:
            error_text = response.text
            print(f"ERROR: Prover returned status {response.status_code}. Raw response: {error_text}")
            try:
                error_data = response.json()
            except Exception:
                error_data = {"error": error_text}
            raise HTTPException(status_code=response.status_code, detail=f"Prover error: {error_data}")
            
        try:
            result = response.json()
            # Shinami returns { "result": "..." }, Mysten returns { "proof": "..." } or the proof directly
            if is_shinami:
                proof = result.get("result")
            else:
                proof = result.get("proof") if isinstance(result, dict) else result
        except Exception as e:
            print(f"ERROR: Failed to parse prover JSON response: {response.text}")
            raise HTTPException(status_code=500, detail=f"Invalid JSON from prover: {str(e)}")

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
