import type { FormSchema, FormSubmission, UserProfile } from '../types/form';

async function getWalrusClient() {
  const { SuiGrpcClient } = await import('@mysten/sui/grpc');
  const { walrus } = await import('@mysten/walrus');
  return new SuiGrpcClient({
    network: 'mainnet',
    baseUrl: 'https://fullnode.mainnet.sui.io:443',
  }).$extend(walrus());
}

async function writeBlobFlow(
  data: unknown,
  address: string,
  signTx: (tx: Record<string, unknown>) => Promise<Record<string, unknown>>
): Promise<string> {
  const client = await getWalrusClient();
  const jsonStr = JSON.stringify(data);
  const flow = client.walrus.writeBlobFlow({ blob: new TextEncoder().encode(jsonStr) });
  await flow.encode();

  const regTx = flow.register({ epochs: 2, owner: address, deletable: false });
  const regResult = await signTx(regTx);
  const digest = regResult?.digest || regResult?.effects?.transactionDigest || regResult?.Transaction?.digest;
  if (!digest) throw new Error('Registration failed');
  await flow.upload({ digest });

  const certTx = flow.certify();
  await signTx(certTx);

  const blobId = flow.blobId;
  if (!blobId) throw new Error('No blobId from Walrus flow');
  return blobId;
}

export async function storeBlobWithWallet(
  data: unknown,
  address: string,
  signAndExecute: (tx: Record<string, unknown>) => Promise<Record<string, unknown>>
): Promise<{ blobId: string }> {
  const blobId = await writeBlobFlow(data, address, signAndExecute);
  return { blobId };
}

export async function storeBlobWithKeypair(
  data: unknown,
  keypair: { signAndExecuteTransaction: (opts: { transaction: Record<string, unknown>; client: Record<string, unknown> }) => Promise<{ digest?: string }> },
  address: string
): Promise<{ blobId: string }> {
  const { SuiGrpcClient } = await import('@mysten/sui/grpc');
  const suiClient = new SuiGrpcClient({
    network: 'mainnet',
    baseUrl: 'https://fullnode.mainnet.sui.io:443',
  });
  const signTx = async (tx: Record<string, unknown>) => {
    const result = await keypair.signAndExecuteTransaction({ transaction: tx, client: suiClient as unknown as Record<string, unknown> });
    const digest = result?.digest;
    if (!digest) throw new Error('Transaction failed');
    return { digest, Transaction: { digest } } as Record<string, unknown>;
  };
  const blobId = await writeBlobFlow(data, address, signTx);
  return { blobId };
}

export async function storeBlob(data: unknown): Promise<{ blobId: string; objectId: string }> {
  const response = await fetch(`/api/walrus/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, epochs: 2 }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Walrus store failed: ${response.status} — ${text}`);
  }

  return response.json();
}

export async function storeForm(form: FormSchema): Promise<{ blobId: string; objectId: string }> {
  return storeBlob({
    type: 'form',
    version: '1.0',
    ...form,
  });
}

export async function storeSubmission(submission: FormSubmission): Promise<{ blobId: string; objectId: string }> {
  return storeBlob({
    type: 'submission',
    version: '1.0',
    ...submission,
  });
}

export async function readBlob(blobId: string): Promise<unknown> {
  const response = await fetch(`/api/walrus/read/${blobId}`);
  if (!response.ok) throw new Error(`Failed to read blob: ${response.statusText}`);
  return response.json();
}

export async function readForm(blobId: string): Promise<FormSchema> {
  const data = await readBlob(blobId);
  return data as FormSchema;
}

export async function readSubmission(blobId: string): Promise<FormSubmission> {
  const data = await readBlob(blobId);
  return data as FormSubmission;
}

export function generateFormLink(formId: string): string {
  return `${window.location.origin}/form/${formId}`;
}

export function downloadCSV(submissions: FormSubmission[], form: FormSchema): string {
  if (submissions.length === 0) return '';

  const headers = ['Submitted At', 'Wallet Address', ...form.fields.map(f => f.label)];
  const rows = submissions.map(sub => {
    const row = [
      sub.submittedAt,
      sub.walletAddress || 'anonymous',
      ...form.fields.map(f => {
        const value = sub.data[f.id];
        if (value === undefined || value === null) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      }),
    ];
    return row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export interface SyncData {
  address: string;
  profile: UserProfile;
  blobId?: string;
  lastSynced: string;
  version: string;
}

export async function uploadSyncData(
  profile: UserProfile,
  existingBlobId?: string
): Promise<{ blobId: string; objectId: string }> {
  const syncData: SyncData = {
    address: profile.address,
    profile,
    blobId: existingBlobId,
    lastSynced: new Date().toISOString(),
    version: '1.0',
  };
  return storeBlob(syncData);
}

export async function downloadSyncData(blobId: string): Promise<SyncData | null> {
  try {
    const data = await readBlob(blobId);
    return data as SyncData;
  } catch {
    return null;
  }
}

export async function syncToWalrus(
  profile: UserProfile,
  blobId?: string
): Promise<{ blobId: string; success: boolean }> {
  try {
    const result = await uploadSyncData(profile, blobId);
    return { blobId: result.blobId, success: true };
  } catch (error) {
    console.error('Sync to Walrus failed:', error);
    return { blobId: '', success: false };
  }
}

export async function syncFromWalrus(blobId: string): Promise<{
  success: boolean;
  profile?: UserProfile;
}> {
  try {
    const syncData = await downloadSyncData(blobId);
    if (!syncData) return { success: false };
    return { success: true, profile: syncData.profile };
  } catch (error) {
    console.error('Sync from Walrus failed:', error);
    return { success: false };
  }
}
