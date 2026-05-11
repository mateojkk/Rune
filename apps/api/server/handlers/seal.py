import json
import base64
import uuid
from typing import Any
from fastapi import HTTPException

from server.config import get_network
from server.models import EncryptRequest, EncryptResponse, DecryptRequest

seal_available = False
SealClient = None
PysuiConfiguration = None
PytuskConfiguration = None

try:
    from pytusk import SealClient
    from pysui import PysuiConfiguration
    from pytusk.config.tusk_config import PytuskConfiguration
    seal_available = True
except ImportError:
    pass


def encrypt(request: EncryptRequest) -> EncryptResponse:
    json_data = json.dumps(request.data).encode('utf-8')
    threshold = request.threshold or 2
    
    if seal_available and SealClient:
        import asyncio
        
        async def _encrypt():
            cfg = PytuskConfiguration(
                pysui_config=PysuiConfiguration(
                    group_name=PysuiConfiguration.SUI_JSON_RPC_GROUP,
                    profile_name=get_network(),
                ),
            )
            client = await SealClient.from_config(cfg)
            return await client.encrypt(json_data, threshold=threshold)
        
        try:
            result = asyncio.get_event_loop().run_until_complete(_encrypt())
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(_encrypt())
        
        return EncryptResponse(
            encryptedBytes=base64.b64encode(result.encrypted_object).decode(),
            objectId=result.object_id,
            threshold=result.threshold,
        )
    
    from cryptography.fernet import Fernet
    
    key = Fernet.generate_key()
    f = Fernet(key)
    encrypted = f.encrypt(json_data)
    
    return EncryptResponse(
        encryptedBytes=base64.b64encode(encrypted).decode(),
        backupKey=base64.b64encode(key).decode(),
        objectId=f"0x{uuid.uuid4().hex[:40]}",
        threshold=threshold,
    )


def decrypt(request: DecryptRequest) -> Any:
    encrypted_bytes = base64.b64decode(request.encryptedBytes)
    
    if seal_available and SealClient:
        import asyncio
        
        async def _decrypt():
            cfg = PytuskConfiguration(
                pysui_config=PysuiConfiguration(
                    group_name=PysuiConfiguration.SUI_JSON_RPC_GROUP,
                    profile_name=get_network(),
                ),
            )
            client = await SealClient.from_config(cfg)
            return await client.decrypt(encrypted_bytes, request.backupKey)
        
        try:
            result = asyncio.get_event_loop().run_until_complete(_decrypt())
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(_decrypt())
        
        return json.loads(result)
    
    if not request.backupKey:
        raise HTTPException(status_code=400, detail="backupKey required")
    
    from cryptography.fernet import Fernet
    
    key = base64.b64decode(request.backupKey)
    f = Fernet(key)
    decrypted = f.decrypt(encrypted_bytes)
    return json.loads(decrypted)
