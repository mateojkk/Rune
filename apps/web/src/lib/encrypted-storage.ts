import { storeBlob as storePlainBlob, readBlob as readPlainBlob } from './walrus';
import { encryptWithSeal, decryptWithSeal, type EncryptedData } from './seal';
import type { FormSchema, FormSubmission, UserProfile } from '../types/form';

export interface StoredData<T> {
  encrypted: boolean;
  data: T | EncryptedData;
}

const ENCRYPTION_ENABLED = true;

export async function storeEncryptedBlob<T>(
  data: T
): Promise<{ blobId: string; objectId: string; encrypted: boolean }> {
  if (!ENCRYPTION_ENABLED) {
    const result = await storePlainBlob(data);
    return { ...result, encrypted: false };
  }

  try {
    const encrypted = await encryptWithSeal(data, 2);
    const result = await storePlainBlob({
      type: 'encrypted',
      version: '1.0',
      ...encrypted,
    });
    return { ...result, encrypted: true };
  } catch (error) {
    console.error('Seal encryption failed, falling back to plain storage:', error);
    const result = await storePlainBlob(data);
    return { ...result, encrypted: false };
  }
}

export async function readEncryptedBlob<T>(blobId: string): Promise<T | null> {
  try {
    const raw = await readPlainBlob(blobId);
    const stored = raw as StoredData<T>;

    if (!stored.encrypted) {
      return stored.data as T;
    }

    const encryptedData = stored.data as EncryptedData;
    return await decryptWithSeal<T>(encryptedData);
  } catch (error) {
    console.error('Failed to read blob:', error);
    return null;
  }
}

export async function storeForm(
  form: FormSchema
): Promise<{ blobId: string; objectId: string }> {
  const result = await storeEncryptedBlob(form);
  return { blobId: result.blobId, objectId: result.objectId };
}

export async function storeSubmission(
  submission: FormSubmission
): Promise<{ blobId: string; objectId: string }> {
  const result = await storeEncryptedBlob(submission);
  return { blobId: result.blobId, objectId: result.objectId };
}

export async function storeUserProfile(
  profile: UserProfile
): Promise<{ blobId: string; objectId: string }> {
  const result = await storeEncryptedBlob(profile);
  return { blobId: result.blobId, objectId: result.objectId };
}

export async function readForm(blobId: string): Promise<FormSchema | null> {
  return readEncryptedBlob<FormSchema>(blobId);
}

export async function readSubmission(blobId: string): Promise<FormSubmission | null> {
  return readEncryptedBlob<FormSubmission>(blobId);
}

export async function readUserProfile(blobId: string): Promise<UserProfile | null> {
  return readEncryptedBlob<UserProfile>(blobId);
}