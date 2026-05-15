import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { loginApi } from './api';

export async function loginWithWallet(address: string, signPersonalMessage: (msg: { message: Uint8Array }) => Promise<any>): Promise<string> {
  const timestamp = Date.now();
  const message = `Rune Login: ${timestamp}`;
  const messageBytes = new TextEncoder().encode(message);
  
  const { signature } = await signPersonalMessage({ message: messageBytes });
  
  const { token } = await loginApi(address, message, signature);
  return token;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function loginWithEphemeralKey(address: string, privateKeyBase64: string): Promise<string> {
  const timestamp = Date.now();
  const message = `Rune Login: ${timestamp}`;
  const messageBytes = new TextEncoder().encode(message);
  
  // Create Keypair from private key
  const keypair = Ed25519Keypair.fromSecretKey(base64ToUint8Array(privateKeyBase64));
  
  // Sign the personal message. 
  // Sui signatures for personal messages are flag || sig || pk
  const { signature } = await keypair.signPersonalMessage(messageBytes);
  
  const { token } = await loginApi(address, message, signature);
  return token;
}
