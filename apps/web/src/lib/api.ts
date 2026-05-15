const API_BASE = import.meta.env.VITE_API_BASE;

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('rune_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as any,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/api/data${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Stale or invalid token - clear it
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('rune_token');
      sessionStorage.removeItem('rune_jwt');
      // We don't want to force a reload in the middle of a render, 
      // but we should clear the store.
      const { useWalletStore } = await import('../context/wallet');
      useWalletStore.getState().disconnect();
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export async function loginApi(address: string, message: string, signature: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, message, signature }),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json();
}

export interface WorkspaceDTO {
  uuid: string;
  name: string;
  description: string;
  formIds: string[];
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any;

export interface FormDTO {
  id: string;
  title: string;
  description: string;
  workspaceId: string;
  fields: JsonValue[];
  blobId?: string;
  profilePicture?: string;
  coverPicture?: string;
  isPublished?: boolean;
  walletAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionDTO {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  walletAddress?: string;
  submittedAt: string;
  blobId?: string;
}

export interface SubmissionCreatePayload {
  data: Record<string, unknown>;
  walletAddress?: string;
  submittedAt?: string;
  blobId?: string;
}

// --- Workspaces ---

export async function getWorkspaces(): Promise<WorkspaceDTO[]> {
  return req(`/workspaces`);
}

export async function createWorkspaceApi(name: string): Promise<WorkspaceDTO> {
  return req(`/workspaces`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function deleteWorkspaceApi(uuid: string): Promise<void> {
  await req(`/workspaces/${uuid}`, { method: 'DELETE' });
}

export async function renameWorkspaceApi(uuid: string, name: string): Promise<void> {
  await req(`/workspaces/${uuid}?name=${encodeURIComponent(name)}`, { method: 'PUT' });
}

// --- Forms ---

export async function getForms(workspaceId?: string): Promise<FormDTO[]> {
  let url = `/forms`;
  if (workspaceId) url += `?workspace_id=${encodeURIComponent(workspaceId)}`;
  return req(url);
}

export async function getFormApi(uuid: string): Promise<FormDTO | null> {
  try {
    return await req(`/forms/${uuid}`);
  } catch {
    return null;
  }
}

export async function createFormApi(title: string, description: string, workspaceId: string): Promise<FormDTO> {
  return req(`/forms`, {
    method: 'POST',
    body: JSON.stringify({ title, description, workspace_uuid: workspaceId }),
  });
}

export async function updateFormApi(uuid: string, data: Record<string, unknown>): Promise<FormDTO> {
  return req(`/forms/${uuid}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteFormApi(uuid: string): Promise<void> {
  await req(`/forms/${uuid}`, { method: 'DELETE' });
}

// --- Submissions ---

export async function getSubmissionsApi(formUuid: string): Promise<SubmissionDTO[]> {
  return req(`/submissions?form_uuid=${encodeURIComponent(formUuid)}`);
}

export async function createSubmissionApi(formUuid: string, payload: SubmissionCreatePayload): Promise<SubmissionDTO> {
  return req(`/submissions?form_uuid=${encodeURIComponent(formUuid)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteSubmissionApi(uuid: string): Promise<void> {
  await req(`/submissions/${uuid}`, { method: 'DELETE' });
}

// --- Profile ---

export interface ProfileDTO {
  display_name?: string;
  pfp?: string;
  theme: string;
}

export async function getProfileApi(): Promise<ProfileDTO> {
  return req(`/profile`);
}

export async function updateProfileApi(data: Record<string, unknown>): Promise<ProfileDTO> {
  return req(`/profile`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
