# Deployment Guide

This guide covers the deployment and distribution of AI Creative Assistant across Windows, macOS, and Linux platforms.

## Table of Contents

- [Build Requirements](#build-requirements)
- [Platform-Specific Setup](#platform-specific-setup)
- [Build Process](#build-process)
- [Code Signing](#code-signing)
- [Distribution](#distribution)
- [Auto-Updates](#auto-updates)
- [Troubleshooting](#troubleshooting)

## Build Requirements

### System Requirements

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Python**: 3.8+ (for native modules)
- **Git**: Latest version

### Platform-Specific Requirements

#### Windows
- **Visual Studio Build Tools**: 2019 or later
- **Windows SDK**: 10.0.19041.0 or later
- **Code Signing Certificate**: For production builds

#### macOS
- **Xcode**: 12.0 or later
- **macOS**: 10.15 (Catalina) or later
- **Apple Developer Account**: For code signing and notarization

#### Linux
- **Build essentials**: `build-essential`, `libnss3-dev`, `libatk-bridge2.0-dev`
- **Additional libraries**: `libdrm2`, `libxss1`, `libgconf-2-4`

## Platform-Specific Setup

### Windows Setup

```bash
# Install Windows Build Tools
npm install --global windows-build-tools

# Install additional dependencies
npm install --global node-gyp

# Set up code signing (production only)
# Place your certificate in certs/windows-cert.p12
```

### macOS Setup

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install dependencies
brew install python3

# Set up code signing (production only)
# Import your Developer ID certificate to Keychain
```

### Linux Setup

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential libnss3-dev libatk-bridge2.0-dev \
  libdrm2 libxss1 libgconf-2-4 libxtst6 libxrandr2 libasound2 \
  libpangocairo-1.0-0 libatk1.0-0 libcairo-gobject2 libgtk-3-0 libgdk-pixbuf2.0-0

# CentOS/RHEL/Fedora
sudo yum groupinstall -y "Development Tools"
sudo yum install -y nss-devel atk-devel at-spi2-atk-devel gtk3-devel \
  gdk-pixbuf2-devel libXScrnSaver alsa-lib
```

## Build Process

### Development Build

```bash
# Install dependencies
npm install

# Build for development
npm run build:dev

# Test the build
npm run test:build
```

### Production Build

```bash
# Clean previous builds
npm run clean

# Install production dependencies
npm ci --production

# Build for all platforms
npm run build:all

# Build for specific platform
npm run build:windows
npm run build:macos
npm run build:linux
```

### Build Scripts

The following npm scripts are available:

```json
{
  "scripts": {
    "build:all": "electron-builder --publish=never",
    "build:windows": "electron-builder --win --publish=never",
    "build:macos": "electron-builder --mac --publish=never",
    "build:linux": "electron-builder --linux --publish=never",
    "build:dev": "electron-builder --publish=never --config.directories.buildResources=build-dev",
    "publish": "electron-builder --publish=always",
    "publish:draft": "electron-builder --publish=onTagOrDraft"
  }
}
```

## Code Signing

### Windows Code Signing

1. **Obtain a Code Signing Certificate**
   - Purchase from a trusted CA (DigiCert, Sectigo, etc.)
   - Or use a self-signed certificate for testing

2. **Configure Signing**
   ```json
   // electron-builder configuration
   {
     "win": {
       "certificateFile": "certs/windows-cert.p12",
       "certificatePassword": "${env.WINDOWS_CERT_PASSWORD}",
       "publisherName": "Your Company Name",
       "verifyUpdateCodeSignature": true
     }
   }
   ```

3. **Environment Variables**
   ```bash
   export WINDOWS_CERT_PASSWORD="your-certificate-password"
   ```

### macOS Code Signing and Notarization

1. **Developer ID Certificate**
   - Obtain from Apple Developer Program
   - Import to Keychain Access

2. **Configure Signing**
   ```json
   {
     "mac": {
       "identity": "Developer ID Application: Your Name (TEAM_ID)",
       "hardenedRuntime": true,
       "gatekeeperAssess": false,
       "entitlements": "build/entitlements.mac.plist",
       "entitlementsInherit": "build/entitlements.mac.plist"
     },
     "afterSign": "scripts/notarize.js"
   }
   ```

3. **Notarization Script**
   ```javascript
   // scripts/notarize.js
   const { notarize } = require('electron-notarize');
   
   exports.default = async function notarizing(context) {
     const { electronPlatformName, appOutDir } = context;
     if (electronPlatformName !== 'darwin') return;
   
     const appName = context.packager.appInfo.productFilename;
     
     return await notarize({
       appBundleId: 'com.yourcompany.ai-creative-assistant',
       appPath: `${appOutDir}/${appName}.app`,
       appleId: process.env.APPLE_ID,
       appleIdPassword: process.env.APPLE_ID_PASSWORD,
       teamId: process.env.APPLE_TEAM_ID
     });
   };
   ```

### Linux Package Signing

```bash
# Generate GPG key for package signing
gpg --full-generate-key

# Export public key
gpg --armor --export your-email@domain.com > public-key.asc

# Configure in electron-builder
{
  "linux": {
    "desktop": {
      "StartupWMClass": "ai-creative-assistant"
    },
    "category": "Office"
  },
  "deb": {
    "depends": ["gconf2", "gconf-service", "libnotify4", "libappindicator1", "libxtst6", "libnss3"]
  },
  "rpm": {
    "depends": ["libnotify", "libappindicator"]
  }
}
```

## Distribution

### Release Channels

1. **Stable**: Production releases
2. **Beta**: Pre-release testing
3. **Alpha**: Development builds

### GitHub Releases

```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0

# Build and publish
npm run publish
```

### Custom Distribution Server

```javascript
// Update server configuration
{
  "publish": [
    {
      "provider": "generic",
      "url": "https://releases.yourcompany.com/ai-creative-assistant"
    }
  ]
}
```

### Package Managers

#### Windows (Chocolatey)
```xml
<!-- ai-creative-assistant.nuspec -->
<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd">
  <metadata>
    <id>ai-creative-assistant</id>
    <version>1.0.0</version>
    <title>AI Creative Assistant</title>
    <authors>Your Company</authors>
    <description>AI-powered creative writing assistant</description>
    <projectUrl>https://github.com/yourcompany/ai-creative-assistant</projectUrl>
    <licenseUrl>https://github.com/yourcompany/ai-creative-assistant/blob/main/LICENSE</licenseUrl>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <tags>writing ai creativity</tags>
  </metadata>
  <files>
    <file src="dist\*.exe" target="tools" />
  </files>
</package>
```

#### macOS (Homebrew)
```ruby
# Formula/ai-creative-assistant.rb
class AiCreativeAssistant < Formula
  desc "AI-powered creative writing assistant"
  homepage "https://github.com/yourcompany/ai-creative-assistant"
  url "https://github.com/yourcompany/ai-creative-assistant/releases/download/v1.0.0/ai-creative-assistant-1.0.0-mac.zip"
  sha256 "sha256-hash-here"
  version "1.0.0"

  def install
    prefix.install Dir["*"]
    bin.install_symlink prefix/"AI Creative Assistant.app/Contents/MacOS/AI Creative Assistant" => "ai-creative-assistant"
  end

  test do
    system "#{bin}/ai-creative-assistant", "--version"
  end
end
```

#### Linux (Snap)
```yaml
# snap/snapcraft.yaml
name: ai-creative-assistant
version: '1.0.0'
summary: AI-powered creative writing assistant
description: |
  AI Creative Assistant helps writers create better stories with AI-powered
  suggestions, character development, and plot analysis.

grade: stable
confinement: strict
base: core20

apps:
  ai-creative-assistant:
    command: ai-creative-assistant
    desktop: usr/share/applications/ai-creative-assistant.desktop
    plugs:
      - home
      - network
      - audio-playback
      - desktop
      - desktop-legacy
      - wayland
      - x11

parts:
  ai-creative-assistant:
    plugin: dump
    source: dist/
    stage-packages:
      - libnss3
      - libatk-bridge2.0-0
      - libdrm2
      - libxss1
      - libgconf-2-4
```

## Auto-Updates

### Configuration

```json
{
  "publish": [
    {
      "provider": "github",
      "owner": "yourcompany",
      "repo": "ai-creative-assistant"
    }
  ],
  "updater": {
    "enabled": true,
    "checkForUpdatesOnStart": true,
    "autoDownload": false,
    "autoInstallOnAppQuit": true
  }
}
```

### Update Server Setup

```javascript
// update-server.js
const express = require('express');
const { createReadStream, statSync } = require('fs');
const { join } = require('path');

const app = express();
const RELEASES_DIR = './releases';

// Serve update metadata
app.get('/update/:platform/:version', (req, res) => {
  const { platform, version } = req.params;
  
  // Check for newer version
  const latestVersion = getLatestVersion(platform);
  
  if (isNewerVersion(latestVersion, version)) {
    res.json({
      version: latestVersion,
      files: getUpdateFiles(platform, latestVersion),
      path: `/download/${platform}/${latestVersion}`,
      sha512: getFileSha512(platform, latestVersion),
      releaseDate: getReleaseDate(latestVersion)
    });
  } else {
    res.status(204).send();
  }
});

// Serve update files
app.get('/download/:platform/:version/:file', (req, res) => {
  const { platform, version, file } = req.params;
  const filePath = join(RELEASES_DIR, platform, version, file);
  
  if (fileExists(filePath)) {
    const stat = statSync(filePath);
    res.set({
      'Content-Length': stat.size,
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file}"`
    });
    
    createReadStream(filePath).pipe(res);
  } else {
    res.status(404).send('File not found');
  }
});

app.listen(3000, () => {
  console.log('Update server running on port 3000');
});
```

## Troubleshooting

### Common Build Issues

#### Node.js Version Mismatch
```bash
# Use Node Version Manager
nvm install 18
nvm use 18

# Or update Node.js directly
npm install -g n
n 18
```

#### Native Module Compilation Errors
```bash
# Rebuild native modules
npm rebuild

# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Code Signing Issues

**Windows:**
```bash
# Verify certificate
certutil -dump your-cert.p12

# Test signing
signtool sign /f your-cert.p12 /p password /t http://timestamp.digicert.com test-file.exe
```

**macOS:**
```bash
# List available certificates
security find-identity -v -p codesigning

# Verify app signature
codesign -vvv --deep --strict YourApp.app

# Check notarization status
xcrun altool --notarization-info <request-id> -u your-apple-id
```

### Runtime Issues

#### Application Won't Start
1. Check system requirements
2. Verify all dependencies are installed
3. Run from command line to see error messages
4. Check application logs

#### Performance Issues
1. Monitor memory usage
2. Check for memory leaks
3. Profile CPU usage
4. Optimize renderer processes

#### Update Failures
1. Check network connectivity
2. Verify update server accessibility
3. Check file permissions
4. Review update logs

### Platform-Specific Issues

#### Windows
- **Antivirus False Positives**: Submit to antivirus vendors for whitelisting
- **SmartScreen Warnings**: Build reputation through code signing and user feedback
- **Permission Errors**: Run as administrator or adjust UAC settings

#### macOS
- **Gatekeeper Blocks**: Ensure proper code signing and notarization
- **Quarantine Attributes**: Remove with `xattr -cr YourApp.app`
- **Rosetta 2**: Test on Apple Silicon Macs

#### Linux
- **Missing Dependencies**: Install required system libraries
- **AppImage Issues**: Check FUSE availability
- **Snap Confinement**: Review snap permissions and plugs

### Debugging Tools

#### Electron DevTools
```javascript
// Enable DevTools in production (for debugging)
if (process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true') {
  mainWindow.webContents.openDevTools();
}
```

#### Logging
```javascript
// Enhanced logging
const log = require('electron-log');

log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

// Log to file
log.info('Application started');
log.error('Error occurred:', error);
```

#### Crash Reporting
```javascript
// Sentry integration
const Sentry = require('@sentry/electron');

Sentry.init({
  dsn: 'your-sentry-dsn',
  environment: process.env.NODE_ENV
});
```

## Support and Maintenance

### Monitoring
- Set up application analytics
- Monitor crash reports
- Track update adoption rates
- Monitor performance metrics

### User Support
- Provide clear error messages
- Include diagnostic information
- Offer multiple support channels
- Maintain comprehensive documentation

### Maintenance Schedule
- **Security Updates**: As needed
- **Bug Fixes**: Monthly
- **Feature Updates**: Quarterly
- **Major Releases**: Bi-annually

For additional support, please refer to:
- [Installation Guide](./INSTALLATION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [API Documentation](../api/README.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)