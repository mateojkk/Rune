import { Secp256k1Keypair, Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { decodeJwt, generateNonce, computeZkLoginAddress, getExtendedEphemeralPublicKey, getZkLoginSignature } from '@mysten/sui/zklogin';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { getSuiRpcUrl, getCurrentNetwork } from './network';
import { useConfigStore } from '../stores/config';
import { useWalletStore } from '../context/wallet';

export type OAuthProvider = 'google';

export interface ZkLoginConfig {
  network: 'mainnet' | 'testnet';
  clientId: string;
  redirectUrl: string;
}

export const DEFAULT_CONFIG: ZkLoginConfig = {
  network: import.meta.env.VITE_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id.apps.googleusercontent.com',
  // Always derive redirect URL from the current origin at runtime.
  // The VITE_REDIRECT_URL env var is baked at build time and may point to localhost
  // even when deployed to production (e.g. Vercel).
  redirectUrl:
    typeof window !== 'undefined' ? `${window.location.origin}/app/auth/callback` : '',
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
  
  // Use crypto.getRandomValues to ensure exactly 16 bytes (128 bits)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const randomness128 = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')).toString();
  console.log('[zkLogin] Generated 128-bit randomness:', randomness128);

  const suiClient = new SuiJsonRpcClient({ url: getSuiRpcUrl(), network: getCurrentNetwork() });
  const { epoch } = await suiClient.getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + 10;

  const nonce = generateNonce(publicKey, maxEpoch, randomness128);
  
  return {
    ephemeralKeyPair: { privateKey, publicKey: keypair.getPublicKey().toBase64() },
    nonce,
    maxEpoch,
    randomness: randomness128,
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
  zkLoginProofCache = null;
  sessionStorage.removeItem('zklogin_session');
  sessionStorage.removeItem('zklogin_nonce');
  sessionStorage.removeItem('zklogin_provider');
  sessionStorage.removeItem('zklogin_jwt');
}

function getApiBase() {
  return useConfigStore.getState().apiBase || import.meta.env.VITE_API_BASE || '';
}

export function getStoredProvider(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('zklogin_provider');
}

export async function getUserSalt(sub: string, iss: string): Promise<string> {
  const input = `${iss}:${sub}:rune-2024`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  // Take first 16 bytes for 128-bit salt (required by Mysten prover)
  const hashArray = Array.from(new Uint8Array(hashBuffer)).slice(0, 16);
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return BigInt(`0x${hashHex}`).toString(10);
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
    throw new Error('Sign-in session was not found. Please try again.');
  }
  
  const decoded = decodeJwt(jwt);
  if (!decoded) {
    clearSession();
    throw new Error('Google returned an invalid ID token.');
  }
  
  const nonceStored = sessionStorage.getItem('zklogin_nonce');
  const decodedAny = decoded as { nonce?: string };
  if (decodedAny.nonce !== nonceStored) {
    throw new Error('Sign-in verification failed due to a nonce mismatch. Please try again.');
  }
  
  const userSalt = await getUserSalt(decoded.sub, decoded.iss);
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

type ZkLoginJwt = {
  sub: string;
  iss: string;
  aud: string | string[];
};

let zkLoginProofCache: Promise<unknown> | null = null;

async function getZkLoginProof(session: ZkLoginSession, jwt: string, decoded: ZkLoginJwt) {
  if (!zkLoginProofCache) {
    zkLoginProofCache = (async () => {
      const apiBase = getApiBase();
      const userSalt = await getUserSalt(decoded.sub, decoded.iss);
      const ephemeralPublicKey = new Secp256k1PublicKey(session.ephemeralKeyPair.publicKey);
      const aud = Array.isArray(decoded.aud) ? decoded.aud[0] : decoded.aud;

      const response = await fetch(`${apiBase}/api/zklogin/prove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jwt,
          ephemeral_public_key: getExtendedEphemeralPublicKey(ephemeralPublicKey),
          max_epoch: session.maxEpoch,
          jwt_randomness: session.randomness,
          user_salt: userSalt,
          sub: decoded.sub,
          iss: decoded.iss,
          aud,
          kc_name: 'sub',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`zkLogin proof request failed: ${error || response.statusText}`);
      }

      const result = await response.json();
      return result.proof;
    })().catch((error) => {
      zkLoginProofCache = null;
      throw error;
    });
  }

  return zkLoginProofCache;
}

export async function createZkLoginPersonalMessageSigner(address: string): Promise<{
  toSuiAddress(): string;
  signPersonalMessage(message: Uint8Array): Promise<{ signature: string }>;
}> {
  const walletStore = useWalletStore.getState();
  const session = getSession() || walletStore.zkLoginSession;
  const jwt = (typeof window !== 'undefined' ? sessionStorage.getItem('zklogin_jwt') : null) || walletStore.jwt;
  
  if (!session || !jwt) {
    throw new Error('zkLogin session is missing. Please sign in again.');
  }

  const decoded = decodeJwt(jwt) as ZkLoginJwt | null;
  if (!decoded) {
    throw new Error('Stored zkLogin token is invalid. Please sign in again.');
  }

  const ephemeralKeypair = Secp256k1Keypair.fromSecretKey(session.ephemeralKeyPair.privateKey);

  return {
    toSuiAddress: () => address,
    signPersonalMessage: async (message: Uint8Array) => {
      const proof = await getZkLoginProof(session, jwt, decoded);
      const { signature: userSignature } = await ephemeralKeypair.signPersonalMessage(message);
      const signature = getZkLoginSignature({
        inputs: proof as never,
        maxEpoch: session.maxEpoch,
        userSignature,
      });
      return { signature };
    },
  };
}
