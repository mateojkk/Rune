import { Secp256k1Keypair, Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { decodeJwt, generateNonce, generateRandomness, computeZkLoginAddress } from '@mysten/sui/zklogin';

export type OAuthProvider = 'google';

export interface ZkLoginConfig {
  network: 'mainnet' | 'testnet';
  clientId: string;
  redirectUrl: string;
}

export const DEFAULT_CONFIG: ZkLoginConfig = {
  network: import.meta.env.VITE_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id.apps.googleusercontent.com',
  redirectUrl: import.meta.env.VITE_REDIRECT_URL || typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '',
};

export interface EphemeralKeyPair {
  privateKey: string;
  publicKey: string;
}

export interface ZkLoginSession {
  ephemeralKeyPair: EphemeralKeyPair;
  nonce: string;
  maxEpoch: number;
  randomness: string;
  createdAt: number;
}

function getRandomHex(len: number = 32): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let result = '';
  for (let i = 0; i < len; i++) {
    result += arr[i].toString(16).padStart(2, '0');
  }
  return result;
}

export async function generateEphemeralKeyPair(): Promise<EphemeralKeyPair> {
  const keypair = new Secp256k1Keypair();
  const privateKey = keypair.getSecretKey();
  const publicKey = keypair.getPublicKey().toBase64();
  
  return {
    privateKey,
    publicKey,
  };
}

export async function createSession(): Promise<ZkLoginSession> {
  const keypair = new Secp256k1Keypair();
  const privateKey = keypair.getSecretKey();
  const publicKey = new Secp256k1PublicKey(keypair.getPublicKey().toRawBytes());
  const randomness = generateRandomness();
  const maxEpoch = Math.floor(Date.now() / 1000) + 3600;
  const nonce = generateNonce(publicKey, maxEpoch, randomness);
  
  return {
    ephemeralKeyPair: { privateKey, publicKey: keypair.getPublicKey().toBase64() },
    nonce,
    maxEpoch,
    randomness,
    createdAt: Date.now(),
  };
}

export async function getOAuthUrl(provider: OAuthProvider): Promise<string> {
  const session = await createSession();
  
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('zklogin_session', JSON.stringify({
      ...session,
      ephemeralKeyPair: {
        ...session.ephemeralKeyPair,
        privateKey: session.ephemeralKeyPair.privateKey,
      },
    }));
    sessionStorage.setItem('zklogin_nonce', session.nonce);
    sessionStorage.setItem('zklogin_provider', provider);
  }
  
  const redirectUrl = encodeURIComponent(DEFAULT_CONFIG.redirectUrl || 'http://localhost:5173/auth/callback');
  
  const oauthUrls: Record<OAuthProvider, string> = {
    google: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${DEFAULT_CONFIG.clientId}&redirect_uri=${redirectUrl}&response_type=id_token&scope=openid%20profile%20email&nonce=${session.nonce}`,
  };
  
  return oauthUrls[provider];
}

export function getSession(): ZkLoginSession | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem('zklogin_session');
  if (!stored) return null;
  
  try {
    const session: ZkLoginSession = JSON.parse(stored);
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('zklogin_session');
  sessionStorage.removeItem('zklogin_nonce');
  sessionStorage.removeItem('zklogin_provider');
  sessionStorage.removeItem('zklogin_jwt');
}

export function getStoredProvider(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('zklogin_provider');
}

export function getUserSalt(address: string): string {
  if (typeof window === 'undefined') return '0';
  
  const key = `rune_salt_${address.toLowerCase()}`;
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  
  const newSalt = getRandomHex(32);
  localStorage.setItem(key, newSalt);
  return newSalt;
}

export function clearUserSalt(address: string) {
  if (typeof window === 'undefined') return;
  const key = `rune_salt_${address.toLowerCase()}`;
  localStorage.removeItem(key);
}

export async function handleOAuthCallback(): Promise<{
  address: string;
  provider: string;
  jwt: string;
  session: ZkLoginSession;
} | null> {
  const hash = window.location.hash;
  if (!hash || !hash.includes('id_token')) return null;
  
  const params = new URLSearchParams(hash.substring(1));
  const jwt = params.get('id_token');
  if (!jwt) return null;
  
  const session = getSession();
  const provider = getStoredProvider();
  if (!session || !provider) {
    clearSession();
    return null;
  }
  
  const decoded = decodeJwt(jwt);
  if (!decoded) {
    clearSession();
    return null;
  }
  
  const nonceStored = sessionStorage.getItem('zklogin_nonce');
  const decodedAny = decoded as { nonce?: string };
  if (decodedAny.nonce !== nonceStored) {
    console.error('nonce mismatch');
    return null;
  }
  
  const userSalt = getUserSalt('temp');
  const address = computeZkLoginAddress({
    claimName: 'sub',
    claimValue: decoded.sub,
    iss: decoded.iss,
    aud: decoded.aud,
    userSalt,
    legacyAddress: false,
  });
  
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('zklogin_jwt', jwt);
  }
  
  return {
    address,
    provider,
    jwt,
    session,
  };
}