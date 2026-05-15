import type { FormSchema, FormSubmission, FormField, UserProfile, Workspace } from '../types/form';
import { getWorkspaces as apiGetWorkspaces, createWorkspaceApi, deleteWorkspaceApi, renameWorkspaceApi, getForms, getFormApi, createFormApi, updateFormApi, deleteFormApi, getSubmissionsApi, createSubmissionApi, deleteSubmissionApi, getProfileApi, updateProfileApi, type SubmissionCreatePayload } from './api';
export type { Workspace };

// --- Synchronous helpers (local state) ---

const STORAGE_KEY = 'walrus_forms_app_state';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface FullAppState {
  profiles: Record<string, UserProfile>;
  currentAddress: string | null;
}

function getFullAppState(): FullAppState {
  if (typeof window === 'undefined') return { profiles: {}, currentAddress: null };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { profiles: {}, currentAddress: null };
  } catch {
    return { profiles: {}, currentAddress: null };
  }
}

function saveFullAppState(state: FullAppState): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* */ }
}

export function setCurrentUser(address: string): void {
  const state = getFullAppState();
  state.currentAddress = address.toLowerCase();
  if (!state.profiles[address.toLowerCase()]) {
    state.profiles[address.toLowerCase()] = {
      address: address.toLowerCase(),
      forms: [], submissions: {}, workspaces: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }
  saveFullAppState(state);
}

export function clearCurrentUser(): void {
  const state = getFullAppState();
  state.currentAddress = null;
  saveFullAppState(state);
}

export function getCurrentUserAddress(): string | null {
  return getFullAppState().currentAddress;
}

// --- Async API-backed functions ---

// --- Workspaces ---

let _workspaceCache: { uuid: string; name: string; description: string; formIds: string[]; createdAt: string; updatedAt: string }[] = [];

export async function getWorkspaces(): Promise<Workspace[]> {
  try {
    const data = await apiGetWorkspaces();
    _workspaceCache = data;
    return data.map(w => ({
      id: w.uuid,
      name: w.name,
      formIds: w.formIds,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const w = await createWorkspaceApi(name);
  return { id: w.uuid, name: w.name, formIds: w.formIds, createdAt: w.createdAt, updatedAt: w.updatedAt };
}

export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  await renameWorkspaceApi(workspaceId, name);
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await deleteWorkspaceApi(workspaceId);
}

// --- Forms ---

let _formCache: FormSchema[] = [];

export async function getAllForms(): Promise<FormSchema[]> {
  try {
    const data = await getForms();
    _formCache = data.map(f => ({
      id: f.id,
      title: f.title,
      description: f.description,
      workspaceId: f.workspaceId,
      fields: f.fields as FormField[],
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      blobId: f.blobId,
      profilePicture: f.profilePicture,
      coverPicture: f.coverPicture,
      isPublished: f.isPublished,
      walletAddress: f.walletAddress || '',
    }));
    return _formCache;
  } catch {
    return _formCache;
  }
}

export async function getForm(formId: string): Promise<FormSchema | null> {
  const cached = _formCache.find(f => f.id === formId);
  if (cached) return cached;
  try {
    const f = await getFormApi(formId);
    if (!f) return null;
    return {
      id: f.id, title: f.title, description: f.description,
      workspaceId: f.workspaceId, fields: f.fields as FormField[],
      createdAt: f.createdAt, updatedAt: f.updatedAt,
      blobId: f.blobId, profilePicture: f.profilePicture,
      coverPicture: f.coverPicture, isPublished: f.isPublished,
      walletAddress: f.walletAddress || '',
    };
  } catch {
    return null;
  }
}

export async function createForm(title: string, description: string, workspaceId?: string): Promise<FormSchema> {
  let wsId = workspaceId?.trim() || '';
  if (!wsId) {
    const workspaces = _workspaceCache.length > 0
      ? _workspaceCache
      : await apiGetWorkspaces();
    _workspaceCache = workspaces;
    if (workspaces.length === 1) {
      wsId = workspaces[0].uuid;
    } else {
      throw new Error('Select a workspace before creating a form');
    }
  }
  const f = await createFormApi(title, description, wsId);
  const form: FormSchema = {
    id: f.id, title: f.title, description: f.description,
    workspaceId: f.workspaceId, fields: f.fields as FormField[],
    createdAt: f.createdAt, updatedAt: f.updatedAt,
    blobId: f.blobId, profilePicture: f.profilePicture,
    coverPicture: f.coverPicture, isPublished: f.isPublished,
    walletAddress: getCurrentUserAddress() || '',
  };
  _formCache.push(form);
  return form;
}

export async function updateForm(formId: string, updates: Partial<FormSchema>): Promise<void> {
  const body: Record<string, unknown> = {};
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.fields !== undefined) body.fields = updates.fields;
  if (updates.blobId !== undefined) body.blob_id = updates.blobId;
  if (updates.profilePicture !== undefined) body.profile_picture = updates.profilePicture;
  if (updates.coverPicture !== undefined) body.cover_picture = updates.coverPicture;
  if (updates.isPublished !== undefined) body.is_published = updates.isPublished;
  const updated = await updateFormApi(formId, body);
  const idx = _formCache.findIndex(f => f.id === formId);
  if (idx !== -1) {
    _formCache[idx] = {
      ..._formCache[idx], ...updates,
      updatedAt: updated.updatedAt,
    };
  }
}

export async function deleteForm(formId: string): Promise<void> {
  await deleteFormApi(formId);
  _formCache = _formCache.filter(f => f.id !== formId);
}

export async function addField(formId: string, field: Omit<FormField, 'id'>): Promise<FormField | null> {
  const form = _formCache.find(f => f.id === formId);
  if (!form) return null;
  const newField: FormField = { ...field, id: uuidv4() };
  const fields = [...form.fields, newField];
  await updateForm(formId, { fields });
  return newField;
}

export async function updateField(formId: string, fieldId: string, updates: Partial<FormField>): Promise<void> {
  const form = _formCache.find(f => f.id === formId);
  if (!form) return;
  const fields = form.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f);
  await updateForm(formId, { fields });
}

export async function deleteField(formId: string, fieldId: string): Promise<void> {
  const form = _formCache.find(f => f.id === formId);
  if (!form) return;
  const fields = form.fields.filter(f => f.id !== fieldId);
  await updateForm(formId, { fields });
}

// --- Submissions ---

export async function getSubmissions(formId: string): Promise<FormSubmission[]> {
  try {
    const data = await getSubmissionsApi(formId);
    return data.map(s => ({
      id: s.id,
      formId: s.formId,
      data: s.data,
      submittedAt: s.submittedAt,
      walletAddress: s.walletAddress,
      blobId: s.blobId,
    }));
  } catch {
    return [];
  }
}

export async function addSubmission(formId: string, submission: SubmissionCreatePayload): Promise<FormSubmission> {
  const s = await createSubmissionApi(formId, submission);
  return {
    id: s.id, formId: s.formId, data: s.data,
    submittedAt: s.submittedAt, walletAddress: s.walletAddress, blobId: s.blobId,
  };
}

export async function deleteSubmission(_formId: string, submissionId: string): Promise<void> {
  await deleteSubmissionApi(submissionId);
}

const _submissionCache: Record<string, FormSubmission[]> = {};

export function filterSubmissions(
  formId: string,
  filters: { search?: string; startDate?: string; endDate?: string }
): FormSubmission[] {
  let subs = _submissionCache[formId] || [];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    subs = subs.filter(s => JSON.stringify(s.data).toLowerCase().includes(q));
  }
  if (filters.startDate) subs = subs.filter(s => s.submittedAt >= filters.startDate!);
  if (filters.endDate) subs = subs.filter(s => s.submittedAt <= filters.endDate!);
  return subs;
}

export function cacheSubmissions(formId: string, subs: FormSubmission[]): void {
  _submissionCache[formId] = subs;
}

export function getCachedSubmissions(formId: string): FormSubmission[] {
  return _submissionCache[formId] || [];
}

export async function deleteWorkspaceAndForms(workspaceId: string): Promise<void> {
  await deleteWorkspace(workspaceId);
}

// --- Profile ---

export async function fetchProfile(): Promise<{ displayName: string; pfp: string; theme: string }> {
  try {
    const data = await getProfileApi();
    return {
      displayName: data.display_name || '',
      pfp: data.pfp || '',
      theme: data.theme || 'light',
    };
  } catch {
    return { displayName: '', pfp: '', theme: 'light' };
  }
}

export async function saveProfile(profile: { display_name?: string; pfp?: string; theme?: string }): Promise<void> {
  await updateProfileApi(profile);
}
