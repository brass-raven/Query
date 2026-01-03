# Code Signing Setup for Query

This guide walks you through setting up code signing for macOS and the required GitHub secrets.

## Prerequisites

- Apple Developer account ($99/year) - [developer.apple.com](https://developer.apple.com)
- Xcode installed on your Mac
- Access to your GitHub repository settings

## macOS Code Signing

### Step 1: Create a Developer ID Application Certificate

1. Open **Keychain Access** on your Mac
2. Go to **Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority**
3. Enter your email and select "Saved to disk"
4. Go to [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)
5. Click **+** to create a new certificate
6. Select **Developer ID Application** (for distributing outside App Store)
7. Upload your Certificate Signing Request
8. Download and double-click to install the certificate

### Step 2: Export the Certificate

1. Open **Keychain Access**
2. Find your "Developer ID Application: Your Name (TEAM_ID)" certificate
3. Right-click > Export
4. Choose .p12 format
5. Set a strong password (you'll need this later)

### Step 3: Base64 Encode the Certificate

```bash
base64 -i Certificates.p12 -o certificate.txt
```

The contents of `certificate.txt` will be your `APPLE_CERTIFICATE` secret.

### Step 4: Create an App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in and go to **Security > App-Specific Passwords**
3. Generate a new password for "Query Notarization"
4. Save this password (you'll use it as `APPLE_PASSWORD`)

### Step 5: Find Your Team ID

```bash
# List all signing identities
security find-identity -v -p codesigning

# Your Team ID is the 10-character code in parentheses
# Example: "Developer ID Application: John Doe (ABC1234567)"
# Team ID = ABC1234567
```

## GitHub Secrets Setup

Go to your repository **Settings > Secrets and variables > Actions** and add:

| Secret | Description | Example |
|--------|-------------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 certificate | (contents of certificate.txt) |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 file | your-p12-password |
| `APPLE_SIGNING_IDENTITY` | Full certificate name | Developer ID Application: Your Name (ABC1234567) |
| `APPLE_ID` | Your Apple ID email | you@example.com |
| `APPLE_PASSWORD` | App-specific password | xxxx-xxxx-xxxx-xxxx |
| `APPLE_TEAM_ID` | Your 10-character Team ID | ABC1234567 |
| `KEYCHAIN_PASSWORD` | Any random password for CI keychain | random-secure-password |

## Tauri Updater Keys (Optional)

For auto-updates, generate a key pair:

```bash
bun tauri signer generate -w ~/.tauri/query.key
```

Add to GitHub secrets:
| Secret | Description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of ~/.tauri/query.key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password you set when generating |

Add public key to `tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

## Testing Locally

Before pushing, test your signing locally:

```bash
# Build with signing
bun run tauri build

# Verify the signature
codesign -dv --verbose=4 src-tauri/target/release/bundle/macos/Query.app

# Test notarization (requires APPLE_ID and APPLE_PASSWORD env vars)
xcrun notarytool submit src-tauri/target/release/bundle/dmg/Query_0.1.0_aarch64.dmg \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
```

## Releasing

1. Update version in `package.json` and `src-tauri/tauri.conf.json`
2. Commit changes
3. Create and push a tag:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
4. The GitHub Action will automatically:
   - Build for macOS (Intel + Apple Silicon), Windows, Linux
   - Sign and notarize the macOS builds
   - Create a draft release with all installers
   - Publish the release when all builds complete

## Troubleshooting

### "Query is damaged and can't be opened"
Your app isn't signed or notarized. Check the GitHub Actions logs for signing errors.

### "Developer cannot be verified"
The app is signed but not notarized. Ensure `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` secrets are set correctly.

### Code signing fails in CI
Make sure your certificate hasn't expired and all secrets are correctly formatted (no extra newlines).
