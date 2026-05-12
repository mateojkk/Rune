import { resolve } from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'

export default defineConfig(({ mode }) => {
  const appRoot = process.cwd()
  const repoRoot = resolve(appRoot, '../..')
  const env = {
    ...loadEnv(mode, repoRoot, ''),
    ...loadEnv(mode, appRoot, ''),
  }

  return {
    plugins: [react(), wasm()],
    worker: { plugins: () => [wasm()] },
    optimizeDeps: {
      exclude: ['@mysten/walrus-wasm'],
    },
    define: {
      'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || 'http://localhost:3001'),
      'import.meta.env.VITE_WEB_URL': JSON.stringify(env.VITE_WEB_URL || 'http://localhost:5173'),
      'import.meta.env.VITE_REDIRECT_URL': JSON.stringify(env.VITE_REDIRECT_URL || 'http://localhost:5173/app/auth/callback'),
      'import.meta.env.VITE_NETWORK': JSON.stringify(env.NETWORK || 'testnet'),
      'import.meta.env.VITE_WALRUS_PUBLISHER_URL': JSON.stringify(env.WALRUS_PUBLISHER_URL || ''),
      'import.meta.env.VITE_WALRUS_AGGREGATOR_URL': JSON.stringify(env.WALRUS_AGGREGATOR_URL || ''),
      'import.meta.env.VITE_SEAL_PACKAGE_ID': JSON.stringify(env.SEAL_PACKAGE_ID || ''),
      'import.meta.env.VITE_SEAL_KEY_SERVER_1': JSON.stringify(env.SEAL_KEY_SERVER_1 || ''),
      'import.meta.env.VITE_SEAL_KEY_SERVER_2': JSON.stringify(env.SEAL_KEY_SERVER_2 || ''),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || ''),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
