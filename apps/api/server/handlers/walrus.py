import json
import base64
import uuid
from typing import Any
from fastapi import HTTPException

from server.config import WALRUS_PUBLISHER_URL, WALRUS_AGGREGATOR_URL
from server.models import StoreRequest, StoreResponse, EncryptRequest, EncryptResponse, DecryptRequest

walrus_available = False
walrus_client = None

try:
    from walrus import WalrusClient
    walrus_client = WalrusClient(
        publisher_base_url=WALRUS_PUBLISHER_URL,
        aggregator_base_url=WALRUS_AGGREGATOR_URL,
    )
    walrus_available = True
except ImportError:
    walrus_client = None


def store_blob(request: StoreRequest) -> StoreResponse:
    blob_data = json.dumps(request.data).encode('utf-8')
    
    if walrus_available and walrus_client:
        result = walrus_client.put_blob(data=blob_data, epochs=request.epochs)
        return StoreResponse(
            blobId=result.blob_id,
            objectId=result.object_id,
            newlyCreated=result.newly_created,
        )
    
    blob_id = base64.b64encode(uuid.uuid4().bytes).decode('utf-8').rstrip('=')[:44]
    return StoreResponse(
        blobId=blob_id,
        objectId=f"0x{uuid.uuid4().hex[:40]}",
        newlyCreated=True,
    )


def read_blob(blob_id: str) -> Any:
    if not walrus_available or not walrus_client:
        raise HTTPException(status_code=500, detail="walrus not available")
    
    blob_data = walrus_client.get_blob(blob_id)
    return json.loads(blob_data)