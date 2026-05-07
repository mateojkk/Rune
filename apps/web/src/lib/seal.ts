import { useConfigStore } from '../stores/config';

const defaultSealConfig = {
  packageId: import.meta.env.VITE_SEAL_PACKAGE_ID || '0x8d90881fc48eb30d4422db68083b49e7d0f879658444e3a0ed85ce47feaa54b2',
  keyServers: [
    { objectId: import.meta.env.VITE_SEAL_KEY_SERVER_1 || '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', weight: 1 },
    { objectId: import.meta.env.VITE_SEAL_KEY_SERVER_2 || '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8', weight: 1 },
  ],
};

export const SEAL_TESTNET_PACKAGE_ID = defaultSealConfig.packageId;

export interface EncryptedData {
  encryptedBytes: Uint8Array;
  backupKey?: Uint8Array;
  objectId: string;
  threshold: number;
}

export interface SealStatus {
  enabled: boolean;
  initialized: boolean;
  error?: string;
}

interface SealEncryptResponse {
  encryptedBytes: string;
  backupKey?: string;
  objectId: string;
  threshold: number;
}

let sealStatus: SealStatus = {
  enabled: false,
  initialized: false,
};

export function getSealStatus(): SealStatus {
  return sealStatus;
}

export async function initializeSeal(): Promise<boolean> {
  const apiBase = useConfigStore.getState().apiBase;
  
  try {
    const response = await fetch(`${apiBase}/api/health`);
    const data = await response.json();
    
    sealStatus = {
      enabled: data.seal === true,
      initialized: true,
      error: data.seal === false ? 'Seal not available on backend' : undefined,
    };
    return data.seal === true;
  } catch (error) {
    sealStatus = {
      enabled: false,
      initialized: true,
      error: error instanceof Error ? error.message : 'Cannot connect to backend',
    };
    return false;
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binaryString = '';
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}

export async function encryptWithSeal<T>(
  data: T,
  _threshold = 2
): Promise<EncryptedData> {
  const apiBase = useConfigStore.getState().apiBase;
  
  const response = await fetch(`${apiBase}/api/seal/encrypt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    throw new Error(`Encryption failed: ${response.statusText}`);
  }

  const result: SealEncryptResponse = await response.json();

  return {
    encryptedBytes: base64ToUint8Array(result.encryptedBytes),
    backupKey: result.backupKey ? base64ToUint8Array(result.backupKey) : undefined,
    objectId: result.objectId,
    threshold: result.threshold,
  };
}

export async function decryptWithSeal<T>(encryptedData: EncryptedData): Promise<T> {
  const apiBase = useConfigStore.getState().apiBase;
  
  const response = await fetch(`${apiBase}/api/seal/decrypt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encryptedBytes: uint8ArrayToBase64(encryptedData.encryptedBytes),
      backupKey: encryptedData.backupKey 
        ? uint8ArrayToBase64(encryptedData.backupKey) 
        : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Decryption failed: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export { defaultSealConfig as TESTNET_KEY_SERVERS };