# Rune Developer Guide

## Quick Start

```bash
# Install dependencies
npm install

# Run both web and API
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:3001

---

## Google OAuth Setup (Required)

zkLogin uses Google's OAuth 2.0. You need to register a Google Cloud project to get a Client ID.

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name: `Rune Dev` (or any name)
4. Click **Create**

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External**
3. Fill in required fields:
   - **App name**: `Rune`
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue**
5. Scopes: Click **Add or remove scopes** → Search `openid` → Check `...openid` → **Update**
6. Click **Save and Continue**
7. Test users: Click **Add users** → Enter your email → **Save**
8. Back to Dashboard

### Step 3: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Rune Local`
5. **Authorized redirect URIs**: Click **Add URI** → `http://localhost:5173/auth/callback`
6. Click **Create**
7. Copy the **Client ID** (format: `xxxxx.apps.googleusercontent.com`)

### Step 4: Update Environment

1. Edit `.env`:
```bash
VITE_GOOGLE_CLIENT_ID=your-copied-client-id.apps.googleusercontent.com
```

### Step 5: Test

1. Run `npm run dev`
2. Open http://localhost:5173
3. Click **Open App** → Click **Sign In** → Click **Google**
4. You should see Google sign-in screen
5. After signing in, you redirect to app with wallet connected

---

## Network Configuration

### Testnet (Default)

```bash
NETWORK=testnet
```

Uses Sui testnet, Walrus testnet, Seal testnet.

### Mainnet

```bash
NETWORK=mainnet
```

For mainnet, you'll need mainnet URLs:

```bash
# WALRUS
WALRUS_PUBLISHER_URL=https://publisher.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus.space

# SEAL (mainnet package IDs - get from Sui docs)
SEAL_PACKAGE_ID=0x...
SEAL_KEY_SERVER_1=0x...
SEAL_KEY_SERVER_2=0x...
```

---

## Project Structure

```
rune-monorepo/
├── apps/
│   ├── web/           # React + Vite frontend
│   │   └── src/
│   │       ├── lib/      # zklogin, walrus, seal integration
│   │       ├── pages/    # Home, Dashboard, Builder
│   │       ├── components/
│   │       └── stores/    # Zustand state
│   └── api/            # FastAPI backend
│       └── server/
│           ├── handlers/   # Walrus, Seal APIs
│           ├── config.py
│           └── models.py
├── packages/
│   └── shared/        # Shared types
├── .env               # Environment configuration
└── package.json       # Monorepo workspace config
```

---

## Technology Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React + Vite + TypeScript |
| Styling | CSS (dark mode: #141413 bg, #FAF9F5 text, #FFB38A accent) |
| State | Zustand |
| Routing | React Router |
| Auth | Sui zkLogin (Google OAuth) |
| Storage | Walrus (decentralized) |
| Encryption | Seal (threshold encryption) |
| Wallet | Wallet Adapter (fallback) |
| Backend | FastAPI + Python |
| Network | Sui Testnet |

---

## Common Issues

### "id_token not found" in callback

- Check Google Client ID is correct in `.env`
- Check redirect URI matches exactly: `http://localhost:5173/auth/callback`
- Make sure port isn't different (5174 if 5173 in use)

### "nonce mismatch" error

- Session expired or was cleared
- Try signing in again

### Build errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules apps/web/node_modules apps/api/.venv
npm install
```

---

## Deployment

### Environment Variables

All production environment variables need to be set:

```bash
# Production .env
NETWORK=mainnet
VITE_API_BASE=https://api.yourdomain.com
VITE_WEB_URL=https://yourdomain.com
VITE_REDIRECT_URL=https://yourdomain.com/auth/callback
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com

# Mainnet URLs for Walrus/Seal (get from docs)
```

### Build

```bash
npm run build
```

Output in `apps/web/dist`.

### API Deployment

```bash
cd apps/api
./.venv/bin/uvicorn server.app:app --host 0.0.0.0 --port 3001
```

---

## Support

- Sui docs: https://docs.sui.io/
- zkLogin docs: https://docs.sui.io/sui-stack/zklogin-integration
- Walrus docs: https://docs.walrus.space/
- Seal docs: https://docs.sui.io/references/zklogin