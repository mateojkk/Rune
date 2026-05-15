# Rune Seal Policy Package

This Move package defines an owner-only access policy for Seal encryption.

## Deploy

```bash
# Install sui CLI if needed: https://docs.sui.io/references/cli

# Publish to testnet
sui client publish --gas-budget 50000000

# Publish to mainnet
sui client publish --gas-budget 50000000 --network mainnet
```

After publishing, note the package ID from the output and set it as:

```
VITE_SEAL_POLICY_PACKAGE_ID=<published-package-id>
```

On Vercel or in your `.env` file.
