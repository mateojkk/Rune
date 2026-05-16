import { SealClient, SessionKey } from '@mysten/seal';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/bcs';
import { storeBlobWithKeypair, storeBlobWithWallet } from './walrus';
import { getCurrentNetwork, getSuiRpcUrl, getWalrusAggregatorUrl } from './network';
import { useConfigStore } from '../stores/config';

function getSealConfig() {
  const config = useConfigStore.getState().config;
  return {
    packageId: config?.seal?.packageId || import.meta.env.VITE_SEAL_PACKAGE_ID || '0xcb83a248bda5f7a0a431e6bf9e96d184e604130ec5218696e3f1211113b447b7',
    policyPackageId: config?.seal?.policyPackageId || import.meta.env.VITE_SEAL_POLICY_PACKAGE_ID || '',
    keyServers: config?.seal?.keyServers || [
      { objectId: import.meta.env.VITE_SEAL_KEY_SERVER_1 || '0x145540d931f182fef76467dd8074c9839aea126852d90d18e1556fcbbd1208b6', weight: 1 },
    ],
  };
}

function getPolicyPackageId() {
  const { policyPackageId } = getSealConfig();
  if (!policyPackageId) {
    throw new Error(
      'Seal policy package is not configured. Set SEAL_POLICY_PACKAGE_ID on the backend or VITE_SEAL_POLICY_PACKAGE_ID in the web app.'
    );
  }
  return policyPackageId;
}

let _suiClient: SuiGrpcClient | null = null;
let _suiClientNetwork: string | null = null;

function getSuiClient() {
  const network = getCurrentNetwork();
  if (!_suiClient || _suiClientNetwork !== network) {
    _suiClient = new SuiGrpcClient({ network, baseUrl: getSuiRpcUrl() });
    _suiClientNetwork = network;
  }
  return _suiClient;
}

function getSealClient(suiClient: ReturnType<typeof getSuiClient>) {
  const { keyServers } = getSealConfig();
  return new SealClient({
    suiClient,
    serverConfigs: keyServers,
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

  const policyPkg = getPolicyPackageId();

  const { encryptedObject } = await sealClient.encrypt({
    threshold: 1,
    packageId: policyPkg,
    id: ownerAddress,
    data: new TextEncoder().encode(JSON.stringify(data)),
  });

  return storeBlobWithKeypair(encryptedObject, keypair, submitterAddress);
}

export async function encryptAndStoreWithWallet(
  data: unknown,
  ownerAddress: string,
  submitterAddress: string,
  signAndExecute: (tx: Transaction) => Promise<Record<string, unknown>>
): Promise<{ blobId: string }> {
  const suiClient = getSuiClient();
  const sealClient = getSealClient(suiClient);

  const policyPkg = getPolicyPackageId();

  const { encryptedObject } = await sealClient.encrypt({
    threshold: 1,
    packageId: policyPkg,
    id: ownerAddress,
    data: new TextEncoder().encode(JSON.stringify(data)),
  });

  return storeBlobWithWallet(encryptedObject, submitterAddress, signAndExecute);
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

export async function decryptAndRead(
  encryptedData: Uint8Array,
  keypair: { toSuiAddress(): string; signPersonalMessage(msg: Uint8Array): Promise<{ signature: string }> },
  ownerAddress: string,
): Promise<unknown> {
  const suiClient = getSuiClient();
  const sealClient = getSealClient(suiClient);

  const policyPkg = getPolicyPackageId();

  const sessionKey = await SessionKey.create({
    address: ownerAddress,
    packageId: policyPkg,
    ttlMin: 10,
    suiClient,
  });

  const message = sessionKey.getPersonalMessage();
  const { signature } = await keypair.signPersonalMessage(message);
  sessionKey.setPersonalMessageSignature(signature);

  const tx = new Transaction();
  tx.moveCall({
    target: `${policyPkg}::policy::seal_approve`,
    arguments: [tx.pure.vector('u8', Array.from(fromHex(ownerAddress)))],
  });
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  await sealClient.fetchKeys({
    ids: getSealConfig().keyServers.map(s => s.objectId),
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
