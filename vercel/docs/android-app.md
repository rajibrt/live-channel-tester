# Android App From This Vercel Project

This project now includes Capacitor config so you can package the live website as an Android app.

## 1. Install prerequisites

- Node.js 20+
- Android Studio (SDK + emulator/device tools)
- JDK 17 (Android Studio usually manages this)

## 2. Install Capacitor packages

Run inside `vercel/`:

```bash
npm install -D @capacitor/core @capacitor/cli @capacitor/android
```

## 3. Configure app identity and URL

Set these in `vercel/.env.local`:

```env
CAP_APP_ID=com.webtvbd.app
CAP_APP_NAME=WEBTVBD
CAP_SERVER_URL=https://webtvbd.com
```

Notes:
- `CAP_SERVER_URL` should be your deployed HTTPS domain.
- Change `CAP_APP_ID` if you plan to publish to Play Store.

## 4. Generate Android project

```bash
npm run android:setup
npm run android:sync
```

This creates `vercel/android/`.

## 5. Open in Android Studio and build APK

```bash
npm run android:open
```

In Android Studio:
- `Build` -> `Build APK(s)`
- Or `Build` -> `Generate Signed Bundle / APK` for release.

## 6. Install on phone

- Copy generated APK to phone and install.
- Or run directly from Android Studio on connected device.

## Useful scripts

- `npm run android:sync`
- `npm run android:open`
- `npm run android:run`
