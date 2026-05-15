import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { loginApi } from './api';

export async function loginWithWallet(
  address: string,
  signPersonalMessage: (msg: { message: Uint8Array }) => Promise<any>
): Promise<string> {
  const timestamp = Date.now();
  const message = `Rune Login: ${timestamp}`;
  const messageBytes = new TextEncoder().encode(message);
  const { signature } = await signPersonalMessage({ message: messageBytes });
  const { token } = await loginApi(address, message, signature);
  return token;
}

export async function loginWithEphemeralKey(
  address: string,
  privateKeyBech32: string  // suiprivkey... string from Secp256k1Keypair.getSecretKey()
): Promise<string> {
  const timestamp = Date.now();
  const message = `Rune Login: ${timestamp}`;
  const messageBytes = new TextEncoder().encode(message);

  // The ZK-Login ephemeral key is a Secp256k1 key stored in bech32 format
  const keypair = Secp256k1Keypair.fromSecretKey(privateKeyBech32);
  const { signature } = await keypair.signPersonalMessage(messageBytes);

  const { token } = await loginApi(address, message, signature);
  return token;
}
