# DollarCord — Mobile Client (iOS + Android)

An Expo / React Native client. It connects to **any DollarCord server** (cloud or
self-hosted) and runs its UI in a WebView with microphone/camera permissions wired up
for voice and video calls.

## Run (dev)

```bash
npm install
npx expo start          # press i (iOS sim), a (Android), or scan the QR with Expo Go
```

On first launch, enter your server URL (e.g. your self-hosted domain or
`http://localhost:3000` for a local dev server). It's saved for next time; tap
**Switch** in the top bar to change servers.

## Build (stores)

Use [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npm install -g eas-cli
eas build -p ios        # App Store
eas build -p android    # Google Play
```

## Files

| File | Purpose |
|---|---|
| `App.js` | Server picker + WebView shell with media permissions |
| `app.json` | Expo config (mic/camera usage strings, bundle ids) |
| `index.js` | Expo entry |

## Notes

- The WebView grants mic/camera to the loaded server automatically
  (`onPermissionRequest`). Native permission strings are declared in `app.json`.
- A future fully-native client (native WebRTC + push notifications) can replace the
  WebView; this scaffold gets you on both stores fast.
- Other branches: [`docker`](../../tree/docker) (app + image),
  [`selfhost`](../../tree/selfhost) (run your own), [`desktop`](../../tree/desktop) (Electron).
