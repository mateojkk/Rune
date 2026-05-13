import { SealClient, SessionKey } from '@mysten/seal';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { storeBlobWithKeypair } from './walrus';
import { getCurrentNetwork, getSuiRpcUrl, getWalrusAggregatorUrl } from './network';

const SEAL_PACKAGE_ID = import.meta.env.VITE_SEAL_PACKAGE_ID || '0xcb83a248bda5f7a0a431e6bf9e96d184e604130ec5218696e3f1211113b447b7';
const SEAL_KEY_SERVER_1 = import.meta.env.VITE_SEAL_KEY_SERVER_1 || '0x145540d931f182fef76467dd8074c9839aea126852d90d18e1556fcbbd1208b6';

let _suiClient: SuiJsonRpcClient | null = null;
let _suiClientNetwork: string | null = null;

function getSuiClient() {
  const network = getCurrentNetwork();
  if (!_suiClient || _suiClientNetwork !== network) {
    _suiClient = new SuiJsonRpcClient({ url: getSuiRpcUrl(), network });
    _suiClientNetwork = network;
  }
  return _suiClient;
}

function getSealClient(suiClient: ReturnType<typeof getSuiClient>) {
  return new SealClient({
    suiClient,
    serverConfigs: [
      { objectId: SEAL_KEY_SERVER_1, weight: 1 },
    ],
    verifyKeyServers: false,
  });
}

export async function encryptAndStore(
  data: unknown,
  ownerAddress: string,
  keypair: { toSuiAddress(): string },
  submitterAddress: string,
): Promise<{ blobId: string }> {
  const suiClient = getSuiClient();
  const sealClient = getSealClient(suiClient);

  const { encryptedObject } = await sealClient.encrypt({
    threshold: 1,
    packageId: SEAL_PACKAGE_ID,
    id: ownerAddress,
    data: new TextEncoder().encode(JSON.stringify(data)),
  });

  return storeBlobWithKeypair(encryptedObject, keypair, submitterAddress);
}

export async function downloadBlob(blobId: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${getWalrusAggregatorUrl()}/v1/blobs/${blobId}`);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function createApprovalTxBytes(keypair: { toSuiAddress(): string }): Promise<Uint8Array> {
  const suiClient = getSuiClient();
  const tx = new Transaction();
  tx.setSender(keypair.toSuiAddress());
  tx.setGasBudget(10000000n);
  return tx.build({ client: suiClient });
}

export async function decryptAndRead(
  encryptedData: Uint8Array,
  keypair: { toSuiAddress(): string; signPersonalMessage?(msg: Uint8Array): Promise<{ signature: string }> },
  ownerAddress: string,
): Promise<unknown> {
  const suiClient = getSuiClient();
  const sealClient = getSealClient(suiClient);
  const txBytes = await createApprovalTxBytes(keypair);

  const sessionKey = new (SessionKey as any)({
    address: ownerAddress,
    packageId: SEAL_PACKAGE_ID,
    ttlMin: 5,
    signer: keypair,
    suiClient,
  });

  await sealClient.fetchKeys({
    ids: [SEAL_PACKAGE_ID],
    txBytes,
    sessionKey,
    threshold: 1,
  });

  const decrypted = await sealClient.decrypt({
    data: encryptedData,
    sessionKey,
    txBytes,
  });

  return JSON.parse(new TextDecoder().decode(decrypted));
}
