import json
import concurrent.futures
from typing import Any, Optional
from fastapi import HTTPException

from server.config import WALRUS_PUBLISHER_URL, WALRUS_AGGREGATOR_URL
from server.models import StoreRequest, StoreResponse


_walrus_client: Optional[Any] = None

def _get_walrus_client():
    global _walrus_client
    if _walrus_client is not None:
        return _walrus_client
    try:
        from walrus import WalrusClient
        _walrus_client = WalrusClient(
            publisher_base_url=WALRUS_PUBLISHER_URL,
            aggregator_base_url=WALRUS_AGGREGATOR_URL,
        )
    except ImportError:
        _walrus_client = False
    return _walrus_client


def store_blob(request: StoreRequest) -> StoreResponse:
    client = _get_walrus_client()
    if not client:
        raise HTTPException(status_code=503, detail="Walrus SDK not available")

    blob_data = json.dumps(request.data).encode('utf-8')
    try:
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(client.put_blob, data=blob_data, epochs=request.epochs)
            result = future.result(timeout=30)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Walrus store failed: {e}")

    return StoreResponse(
        blobId=result.blob_id,
        objectId=result.object_id,
        newlyCreated=result.newly_created,
    )


def read_blob(blob_id: str) -> Any:
    client = _get_walrus_client()
    if not client:
        raise HTTPException(status_code=503, detail="Walrus SDK not available")
    try:
        blob_data = client.get_blob(blob_id)
        return json.loads(blob_data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Walrus read failed: {e}")
