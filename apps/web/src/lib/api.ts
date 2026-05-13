const API_BASE = import.meta.env.VITE_API_BASE;

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/data${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }
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

export async function getWorkspaces(address: string): Promise<WorkspaceDTO[]> {
  return req(`/workspaces?address=${encodeURIComponent(address)}`);
}

export async function createWorkspaceApi(address: string, name: string): Promise<WorkspaceDTO> {
  return req(`/workspaces?address=${encodeURIComponent(address)}`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

// --- Forms ---

export async function getForms(address: string, workspaceId?: string): Promise<FormDTO[]> {
  let url = `/forms?address=${encodeURIComponent(address)}`;
  if (workspaceId) url += `&workspace_id=${encodeURIComponent(workspaceId)}`;
  return req(url);
}

export async function getFormApi(uuid: string): Promise<FormDTO | null> {
  try {
    return await req(`/forms/${uuid}`);
  } catch {
    return null;
  }
}

export async function createFormApi(address: string, title: string, description: string, workspaceId: string): Promise<FormDTO> {
  return req(`/forms?address=${encodeURIComponent(address)}`, {
    method: 'POST',
    body: JSON.stringify({ title, description, workspace_uuid: workspaceId }),
  });
}

export async function updateFormApi(address: string, uuid: string, data: Record<string, unknown>): Promise<FormDTO> {
  return req(`/forms/${uuid}?address=${encodeURIComponent(address)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteFormApi(address: string, uuid: string): Promise<void> {
  await req(`/forms/${uuid}?address=${encodeURIComponent(address)}`, { method: 'DELETE' });
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

export async function deleteSubmissionApi(address: string, uuid: string): Promise<void> {
  await req(`/submissions/${uuid}?address=${encodeURIComponent(address)}`, { method: 'DELETE' });
}

// --- Profile ---

export interface ProfileDTO {
  display_name?: string;
  pfp?: string;
  theme: string;
}

export async function getProfileApi(address: string): Promise<ProfileDTO> {
  return req(`/profile?address=${encodeURIComponent(address)}`);
}

export async function updateProfileApi(address: string, data: Record<string, unknown>): Promise<ProfileDTO> {
  return req(`/profile?address=${encodeURIComponent(address)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
