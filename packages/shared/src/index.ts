export * from './types/form.js';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface WalletAccount {
  address: string;
  provider: string;
  method: 'zklogin' | 'wallet';
}