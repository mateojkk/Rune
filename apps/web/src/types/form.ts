export type FieldType = 
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'dropdown'
  | 'checkbox'
  | 'multiselect'
  | 'starRating'
  | 'file'
  | 'image'
  | 'video'
  | 'url'
  | 'number';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  description?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  formIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FormSchema {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  walletAddress?: string;
  blobId?: string;
  profilePicture?: string;
  coverPicture?: string;
  isPublished?: boolean;
}

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  submittedAt: string;
  walletAddress?: string;
  blobId?: string;
}

export interface UserProfile {
  address: string;
  forms: FormSchema[];
  submissions: Record<string, FormSubmission[]>;
  workspaces: Workspace[];
  createdAt: string;
  updatedAt: string;
  blobId?: string;
}