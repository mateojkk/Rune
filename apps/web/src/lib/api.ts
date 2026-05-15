const API_BASE = import.meta.env.VITE_API_BASE;

let isRedirecting = false;

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  if (isRedirecting) throw new Error('Redirecting...');

  let token = null;
  let isLoggingIn = false;

  if (typeof window !== 'undefined') {
    const w = window as any;
    if (w.__getRuneToken) {
      token = w.__getRuneToken();
      isLoggingIn = w.__isRuneLoggingIn();
    } else {
      // Fallback to localStorage if the store hasn't mounted yet
      try {
        const stored = localStorage.getItem('rune-wallet');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed.state.jwt || parsed.state.token || null;
          isLoggingIn = !!parsed.state.isLoggingIn;
        }
      } catch (e) {}
    }
  }

  if (isLoggingIn) {
    // Block ALL background data fetches during login
    throw new Error('Login in progress...');
  }

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
    if (isRedirecting) throw new Error('Unauthorized');
    isRedirecting = true;
    
    if (typeof window !== 'undefined') {
      console.warn('[API] 401 detected. Clearing session and resetting...');
      
      // Crucial: Clear Zustand state in memory BEFORE clearing localStorage,
      // otherwise Zustand will write the stale token back to localStorage on page unload!
      const w = window as any;
      if (w.__disconnectRune) {
        try { w.__disconnectRune(); } catch (e) {}
      }

      localStorage.removeItem('rune-wallet');
      sessionStorage.clear();
      window.location.href = '/';
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
