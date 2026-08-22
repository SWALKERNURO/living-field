# Living Field for Windows

## Install

1. Download or open `Living-Field-Setup.exe`.
2. Choose the installation folder when prompted.
3. Leave the desktop and Start menu shortcut options enabled if desired.
4. Launch **Living Field** from either shortcut.

The installer is currently unsigned. Windows SmartScreen may show an “unrecognized app” notice because the project does not yet have a commercial code-signing certificate. If you built the installer yourself or received this exact build from the project owner, choose **More info**, review the application name, and continue only if you trust the file.

## Privacy and security model

- The interface is bundled inside the desktop application and opens from the private `living-field://app` origin.
- Node.js APIs are not exposed to the interface.
- Context isolation and Chromium sandboxing are enabled.
- Navigation is restricted to the bundled application; safe external HTTPS links, if added later, open in the system browser.
- The current prototype does not upload EEG data or reports to a remote service.

## Uninstall

Use **Settings → Apps → Installed apps → Living Field → Uninstall**. User-created project data is preserved by default so that a future installation can reuse it.

## Build from source

```bash
npm install
npm test
npm run desktop:test
npm run desktop:build
```

The final setup program is created at `installer-output/Living-Field-Setup.exe`.

## Distribution note

Before public distribution, sign the installer with a trusted Windows code-signing certificate and publish a checksum alongside the download.

