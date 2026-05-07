import type { FormSchema, FormSubmission, FormField, UserProfile } from '../types/form';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const STORAGE_KEY = 'walrus_forms_app_state';

export interface FullAppState {
  profiles: Record<string, UserProfile>;
  currentAddress: string | null;
}

function getFullAppState(): FullAppState {
  if (typeof window === 'undefined') {
    return { profiles: {}, currentAddress: null };
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { profiles: {}, currentAddress: null };
    }
    return JSON.parse(stored);
  } catch {
    return { profiles: {}, currentAddress: null };
  }
}

function saveFullAppState(state: FullAppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently fail
  }
}

function getCurrentProfile(): UserProfile | null {
  const state = getFullAppState();
  if (!state.currentAddress) return null;
  return state.profiles[state.currentAddress] || null;
}

function getOrCreateCurrentProfile(): UserProfile {
  const state = getFullAppState();
  
  if (!state.currentAddress) {
    throw new Error('No current user address set');
  }
  
  let profile = state.profiles[state.currentAddress];
  
  if (!profile) {
    profile = {
      address: state.currentAddress,
      forms: [],
      submissions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.profiles[state.currentAddress] = profile;
  }
  
  return profile;
}

export function setCurrentUser(address: string): void {
  const state = getFullAppState();
  state.currentAddress = address.toLowerCase();
  
  if (!state.profiles[address.toLowerCase()]) {
    state.profiles[address.toLowerCase()] = {
      address: address.toLowerCase(),
      forms: [],
      submissions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  
  saveFullAppState(state);
}

export function getCurrentUserAddress(): string | null {
  return getFullAppState().currentAddress;
}

export function getUserProfile(address: string): UserProfile | null {
  const state = getFullAppState();
  return state.profiles[address.toLowerCase()] || null;
}

export function createUserProfile(address: string): UserProfile {
  const normalizedAddress = address.toLowerCase();
  const state = getFullAppState();
  
  if (state.profiles[normalizedAddress]) {
    return state.profiles[normalizedAddress];
  }
  
  const profile: UserProfile = {
    address: normalizedAddress,
    forms: [],
    submissions: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  state.profiles[normalizedAddress] = profile;
  saveFullAppState(state);
  
  return profile;
}

export function saveSyncBlobId(address: string, blobId: string): void {
  const state = getFullAppState();
  if (state.profiles[address.toLowerCase()]) {
    state.profiles[address.toLowerCase()].blobId = blobId;
    saveFullAppState(state);
  }
}

export function getSyncBlobId(address: string): string | null {
  const state = getFullAppState();
  return state.profiles[address.toLowerCase()]?.blobId || null;
}

export function createForm(title: string, description: string): FormSchema {
  const profile = getOrCreateCurrentProfile();
  
  const form: FormSchema = {
    id: uuidv4(),
    title,
    description,
    fields: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    walletAddress: profile.address,
  };
  
  profile.forms.push(form);
  profile.updatedAt = new Date().toISOString();
  
  const state = getFullAppState();
  state.profiles[profile.address] = profile;
  saveFullAppState(state);
  
  return form;
}

export function updateForm(formId: string, updates: Partial<FormSchema>): FormSchema | null {
  const profile = getCurrentProfile();
  if (!profile) return null;
  
  const index = profile.forms.findIndex(f => f.id === formId);
  if (index === -1) return null;
  
  profile.forms[index] = {
    ...profile.forms[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  profile.updatedAt = new Date().toISOString();
  
  const state = getFullAppState();
  state.profiles[profile.address] = profile;
  saveFullAppState(state);
  
  return profile.forms[index];
}

export function deleteForm(formId: string): boolean {
  const profile = getCurrentProfile();
  if (!profile) return false;
  
  const index = profile.forms.findIndex(f => f.id === formId);
  if (index === -1) return false;
  
  profile.forms.splice(index, 1);
  delete profile.submissions[formId];
  profile.updatedAt = new Date().toISOString();
  
  const state = getFullAppState();
  state.profiles[profile.address] = profile;
  saveFullAppState(state);
  
  return true;
}

export function getForm(formId: string): FormSchema | null {
  const profile = getCurrentProfile();
  if (!profile) return null;
  return profile.forms.find(f => f.id === formId) || null;
}

export function getAllForms(): FormSchema[] {
  const profile = getCurrentProfile();
  if (!profile) return [];
  return profile.forms;
}

export function addField(formId: string, field: Omit<FormField, 'id'>): FormField | null {
  const profile = getCurrentProfile();
  if (!profile) return null;
  
  const form = profile.forms.find(f => f.id === formId);
  if (!form) return null;
  
  const newField: FormField = {
    ...field,
    id: uuidv4(),
  };
  
  form.fields.push(newField);
  form.updatedAt = new Date().toISOString();
  profile.updatedAt = new Date().toISOString();
  
  const state = getFullAppState();
  state.profiles[profile.address] = profile;
  saveFullAppState(state);
  
  return newField;
}

export function updateField(formId: string, fieldId: string, updates: Partial<FormField>): FormField | null {
  const profile = getCurrentProfile();
  if (!profile) return null;
  
  const form = profile.forms.find(f => f.id === formId);
  if (!form) return null;
  
  const fieldIndex = form.fields.findIndex(f => f.id === fieldId);
  if (fieldIndex === -1) return null;
  
  form.fields[fieldIndex] = {
    ...form.fields[fieldIndex],
    ...updates,
  };
  
  form.updatedAt = new Date().toISOString();
  profile.updatedAt = new Date().toISOString();
  
  const state = getFullAppState();
  state.profiles[profile.address] = profile;
  saveFullAppState(state);
  
  return form.fields[fieldIndex];
}

export function deleteField(formId: string, fieldId: string): boolean {
  const profile = getCurrentProfile();
  if (!profile) return false;
  
  const form = profile.forms.find(f => f.id === formId);
  if (!form) return false;
  
  const index = form.fields.findIndex(f => f.id === fieldId);
  if (index === -1) return false;
  
  form.fields.splice(index, 1);
  form.updatedAt = new Date().toISOString();
  profile.updatedAt = new Date().toISOString();
  
  const state = getFullAppState();
  state.profiles[profile.address] = profile;
  saveFullAppState(state);
  
  return true;
}

export function addSubmission(formId: string, data: Record<string, unknown>, walletAddress?: string): FormSubmission {
  const profile = getOrCreateCurrentProfile();
  
  const submission: FormSubmission = {
    id: uuidv4(),
    formId,
    data,
    submittedAt: new Date().toISOString(),
    walletAddress: walletAddress || profile.address,
  };
  
  if (!profile.submissions[formId]) {
    profile.submissions[formId] = [];
  }
  
  profile.submissions[formId].push(submission);
  profile.updatedAt = new Date().toISOString();
  
  const state = getFullAppState();
  state.profiles[profile.address] = profile;
  saveFullAppState(state);
  
  return submission;
}

export function getSubmissions(formId: string): FormSubmission[] {
  const profile = getCurrentProfile();
  if (!profile) return [];
  return profile.submissions[formId] || [];
}

export function deleteSubmission(formId: string, submissionId: string): boolean {
  const profile = getCurrentProfile();
  if (!profile) return false;
  
  const submissions = profile.submissions[formId];
  if (!submissions) return false;
  
  const index = submissions.findIndex(s => s.id === submissionId);
  if (index === -1) return false;
  
  submissions.splice(index, 1);
  profile.updatedAt = new Date().toISOString();
  
  const state = getFullAppState();
  state.profiles[profile.address] = profile;
  saveFullAppState(state);
  
  return true;
}

export function filterSubmissions(
  formId: string,
  filters: {
    search?: string;
    startDate?: string;
    endDate?: string;
  }
): FormSubmission[] {
  const profile = getCurrentProfile();
  if (!profile) return [];
  
  let submissions = profile.submissions[formId] || [];
  
  if (filters.search) {
    const search = filters.search.toLowerCase();
    submissions = submissions.filter(sub => {
      const searchStr = JSON.stringify(sub.data).toLowerCase();
      return searchStr.includes(search);
    });
  }
  
  if (filters.startDate) {
    submissions = submissions.filter(sub => sub.submittedAt >= filters.startDate!);
  }
  
  if (filters.endDate) {
    submissions = submissions.filter(sub => sub.submittedAt <= filters.endDate!);
  }
  
  return submissions;
}

export function exportUserData(): string {
  const profile = getCurrentProfile();
  if (!profile) return '';
  return JSON.stringify(profile, null, 2);
}

export function importUserData(data: string): boolean {
  try {
    const imported = JSON.parse(data) as UserProfile;
    if (!imported.address) return false;
    
    const state = getFullAppState();
    state.profiles[imported.address.toLowerCase()] = imported;
    saveFullAppState(state);
    return true;
  } catch {
    return false;
  }
}