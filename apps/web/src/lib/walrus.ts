import type { FormSchema, FormSubmission, UserProfile } from '../types/form';
import { useConfigStore } from '../stores/config';

const defaultWalrusUrls = {
  publisher: import.meta.env.VITE_WALRUS_PUBLISHER_URL || 'https://publisher.testnet.walrus.space',
  aggregator: import.meta.env.VITE_WALRUS_AGGREGATOR_URL || 'https://aggregator.testnet.walrus.space',
};

export async function storeBlob(data: unknown): Promise<{ blobId: string; objectId: string }> {
  const apiBase = useConfigStore.getState().apiBase;
  const urls = useConfigStore.getState().config?.walrus ?? defaultWalrusUrls;
  const walrusPublisherUrl = urls.publisher;

  try {
    const response = await fetch(`${apiBase}/api/walrus/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, epochs: 2 }),
    });

    if (!response.ok) {
      throw new Error(`Failed to store blob: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      blobId: result.blobId,
      objectId: result.objectId,
    };
  } catch {
    const encoder = new TextEncoder();
    const jsonString = JSON.stringify(data);
    const blob = encoder.encode(jsonString);

    const response = await fetch(`${walrusPublisherUrl}/v1/store?epochs=2`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: blob,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to store blob: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return {
      blobId: result.newlyCreated?.blobId || result.alreadyCertified?.blobId,
      objectId: result.newlyCreated?.objectId || result.alreadyCertified?.objectId,
    };
  }
}

export async function readBlob(blobId: string): Promise<unknown> {
  const apiBase = useConfigStore.getState().apiBase;
  const urls = useConfigStore.getState().config?.walrus ?? defaultWalrusUrls;
  const walrusAggregatorUrl = urls.aggregator;

  try {
    const response = await fetch(`${apiBase}/api/walrus/read/${blobId}`);

    if (!response.ok) {
      throw new Error(`Failed to read blob: ${response.statusText}`);
    }

    return response.json();
  } catch {
    const response = await fetch(`${walrusAggregatorUrl}/v1/${blobId}`);

    if (!response.ok) {
      throw new Error(`Failed to read blob: ${response.status}`);
    }

    const blob = await response.blob();
    const text = await blob.text();
    return JSON.parse(text);
  }
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
    if (!syncData) {
      return { success: false };
    }
    return { success: true, profile: syncData.profile };
  } catch (error) {
    console.error('Sync from Walrus failed:', error);
    return { success: false };
  }
}