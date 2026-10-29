# Routine

A simple Android app for tracking everyday routines: groceries, gym sessions, language practice and anything else you repeat.

## Status

Phase 1 is in: a **Today** screen and a **Groceries** list where items repeat every day, every few days, on certain weekdays, or just once.

Coming next: Gym (weekly split, set logging), Chinese practice (daily target, flashcards), custom routines and streaks.

## Get the APK

Every push builds an Android APK with GitHub Actions. Open the repo's **Releases**, pick the newest `Routine build`, and download the `.apk` on your phone.

## Develop

```bash
npm install
npm start          # Expo dev server (scan the QR code with Expo Go)
npm run typecheck
npm test           # unit tests for the repeat/schedule logic
```

Code lives in `src/`: screens in `src/app/` (Expo Router), shared UI in `src/components/`, logic and storage in `src/lib/`.

To make a single-file web preview: `npx expo export --platform web --output-dir dist && node scripts/build-preview.mjs dist preview.html`.
