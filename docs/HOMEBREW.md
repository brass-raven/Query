# Homebrew Distribution

This guide explains how to distribute Query via Homebrew Cask.

## Option 1: Add to homebrew-cask (Public)

For maximum reach, submit to the official homebrew-cask repository:

1. After your first release, create a PR to [homebrew-cask](https://github.com/Homebrew/homebrew-cask)
2. Add a file at `Casks/q/query.rb` with the formula below
3. The Homebrew team will review and merge

Users can then install with:
```bash
brew install --cask query
```

## Option 2: Create Your Own Tap (Faster)

Create your own Homebrew tap for faster releases:

### 1. Create a new repository

Create `homebrew-tap` repository on GitHub (e.g., `your-username/homebrew-tap`)

### 2. Add the Cask formula

Create `Casks/query.rb` in your tap repository:

```ruby
cask "query" do
  arch arm: "aarch64", intel: "x64"

  version "0.1.0"
  sha256 arm:   "REPLACE_WITH_ARM64_SHA256",
         intel: "REPLACE_WITH_X64_SHA256"

  url "https://github.com/YOUR_USERNAME/Query/releases/download/v#{version}/Query_#{version}_#{arch}.dmg"
  name "Query"
  desc "Modern PostgreSQL client built with Tauri"
  homepage "https://github.com/YOUR_USERNAME/Query"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: ">= :monterey"

  app "Query.app"

  zap trash: [
    "~/.query",
    "~/Library/Application Support/com.brassraven.query",
    "~/Library/Caches/com.brassraven.query",
    "~/Library/Preferences/com.brassraven.query.plist",
    "~/Library/Saved Application State/com.brassraven.query.savedState",
  ]
end
```

### 3. Generate SHA256 hashes

After each release, update the sha256 values:

```bash
# Download and hash the DMGs
curl -sL "https://github.com/YOUR_USERNAME/Query/releases/download/v0.1.0/Query_0.1.0_aarch64.dmg" | shasum -a 256
curl -sL "https://github.com/YOUR_USERNAME/Query/releases/download/v0.1.0/Query_0.1.0_x64.dmg" | shasum -a 256
```

### 4. Users install from your tap

```bash
brew tap your-username/tap
brew install --cask query
```

## Automating Updates

Add this workflow to automatically update your Homebrew tap when you release:

`.github/workflows/update-homebrew.yml`:

```yaml
name: Update Homebrew

on:
  release:
    types: [published]

jobs:
  update-homebrew:
    runs-on: ubuntu-latest
    steps:
      - name: Update Homebrew formula
        uses: dawidd6/action-homebrew-bump-formula@v3
        with:
          token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
          tap: your-username/tap
          formula: query
          tag: ${{ github.event.release.tag_name }}
```

Create a personal access token with `repo` scope and add it as `HOMEBREW_TAP_TOKEN` secret.

## Version Checklist

When releasing a new version:

1. Update version in `package.json` and `tauri.conf.json`
2. Create git tag: `git tag v0.2.0 && git push origin v0.2.0`
3. Wait for GitHub Actions to build and publish release
4. Update Homebrew formula sha256 hashes (or use automation above)
