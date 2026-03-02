# Android Final Release (WEBTVBD)

## 1) Configure release signing

1. Copy `android/keystore.properties.example` to `android/keystore.properties`.
2. Update values:

```properties
RELEASE_STORE_FILE=../keystore/webtvbd-release.jks
RELEASE_STORE_PASSWORD=your_store_password
RELEASE_KEY_ALIAS=webtvbd
RELEASE_KEY_PASSWORD=your_key_password
APP_VERSION_CODE=1
APP_VERSION_NAME=1.0.0
```

3. Put your `.jks` keystore file in `vercel/keystore/` (or update path).

## 2) Build final APK

From `vercel/android`:

```bash
./gradlew clean assembleRelease
```

Output:
- `app/build/outputs/apk/release/app-release.apk`

## 3) Build Play Store AAB

From `vercel/android`:

```bash
./gradlew clean bundleRelease
```

Output:
- `app/build/outputs/bundle/release/app-release.aab`

## 4) Debug vs Final

- Debug file: `app-debug.apk` (testing only)
- Final file: `app-release.apk` or `app-release.aab`

## 5) Next release versioning

- Increase `APP_VERSION_CODE` every release (must be unique and increasing).
- Update `APP_VERSION_NAME` (example: `1.0.1`, `1.1.0`).
