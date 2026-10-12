# ToLet Odisha Android preview

A Trusted Web Activity for https://www.toletodisha.in, generated with Bubblewrap 1.27.0. The app uses the live website and its existing backend. Website updates appear in the app without an APK release.

## Preview identity

- Package: `in.toletodisha.app.preview`
- Version: `0.1.0` (code 1)
- Android: 7.0 or newer; targets API 36
- Compatible browser required; use a recent Chrome version for testing
- Support: support@toletodisha.in

This package and its disposable testing certificate are separate from the future production package and Play signing key. No private key or password is committed. Notifications are disabled; listing reminders remain email notifications.

## Build

Install JDK 17 and the Android SDK with platform 36 and build tools 36.0.0. Set `JAVA_HOME` and `ANDROID_HOME` to those installations.

From this directory:

```sh
./gradlew assembleRelease
```

The unsigned APK is `app/build/outputs/apk/release/app-release-unsigned.apk`. Use SDK `zipalign` and `apksigner` with a private test keystore to produce an installable APK. The signing certificate's SHA-256 fingerprint must match the preview entry served at `https://www.toletodisha.in/.well-known/assetlinks.json`. Different test keys require adding their fingerprints there. A mismatched certificate causes browser UI to appear instead of a verified full-screen TWA.

Open this directory in Android Studio to build and run. The tracked wrapper uses Gradle 8.11.1; Google Maven and Maven Central supply dependencies.

## Phone review

Install the signed preview APK on an Android phone. Allow installation from the app used to open the APK if Android asks. Test:

1. Open the app and confirm the home page appears without a browser address bar.
2. Browse, filter and open a listing; verify the back button and rotation.
3. Post a test listing, including photo selection. Email remains optional.
4. Check email verification and the verified badge with a test address.
5. Check phone and WhatsApp links, report submission, support/disclaimer and private listing removal.
6. Verify email links from outside the app and return navigation.
7. Disable internet and check the browser's connection error; this preview requires internet and does not cache listings for offline use.

Posting and reporting use production data. Use clearly labelled test content and remove your test listing afterward. Do not assume scheduled 30-day expiry has been tested by installing the app; that job remains in the existing backend.

## Before Play publication

Choose the production package and keep its upload key backed up securely. Replace/add the website association with the Google Play app-signing certificate (not just the upload certificate). Prepare a privacy policy, Play Data Safety answers, store assets and the Anx Platforms developer-account verification. Complete device testing and any testing requirements shown in Play Console. Store approval has not been requested.
