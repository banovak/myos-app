# My OS — the phone app

The companion app for the [My OS](https://softlaunched.io) family: one app, a
module per part of your OS. You switch modules on from ⋯ → Add features. Each
module pairs with infrastructure **you** own and keeps its own credentials;
nothing is shared between them, and nothing passes through anyone else's server.

| Module | What it is | Pairs with |
|---|---|---|
| **Assistant** (`src/jarvis/`) | The assistant's face: tap and talk, background audio, share-sheet "Send a task" | Your assistant gateway's URL + access code (from the My OS: Assistant flow) |
| **Health** (`src/health/`) | Your own health record, on the same database and encryption format as the My OS: Health web app | Your own Supabase project URL + publishable key, then your login + two-step code |

iPhone only for now: Health relies on Apple Health. It isn't built or tested for
Android yet.

## Make it yours

You need an Apple Developer Program membership ($99/yr), a free Expo account,
Node.js 20+, and no Mac (builds run on Expo's servers).

1. `npm install`
2. In `app.json`, replace `com.yourname.myos` (iOS `bundleIdentifier` and Android
   `package`) with an identifier of your own, like `com.janedoe.myos`.
3. `npx eas-cli login`, then `npx eas-cli init` to create your own EAS project.
4. `npx eas-cli build --platform ios --profile production`. The first build asks
   you to sign in to Apple so EAS can create your certificates.
5. `npx eas-cli submit --platform ios` sends it to your App Store Connect; add
   yourself as an internal tester in TestFlight and install it from there. No App
   Store review is needed for internal testing.

Or open the folder in Claude Code and ask it to walk you through these steps.

## The shell (`src/shell/`)

- One module on → no chrome at all (today's clean face).
- Two or more → **page dots** at the top centre, the module's own name becomes
  the **switcher** (tap opens a sheet listing enabled modules, a tick on the
  current one, Add features at the bottom), and a horizontal **swipe in a safe
  zone** moves between them: the whole Jarvis face, or Health's top band
  (its stories, nav, charts and scrubber scroll sideways themselves). Never a
  bottom bar: the bottom belongs to the module.
- `modules.ts` is the registry (enabled list + last-open in AsyncStorage);
  `ModuleShell.tsx` hosts, `AddFeaturesScreen.tsx` toggles and connects.
- Modules ship inside the binary; OTA (`expo-updates`) is for fixes only.

## Jarvis (`src/jarvis/`)

Unchanged from v1.2: `PairScreen` (validates live before saving), `TalkScreen`
(the orb; `@elevenlabs/react-native` + LiveKit WebRTC; conversation token from
`{gateway}/widget-token?transport=webrtc`), `ComposeScreen` (share-sheet landing
pad + queue-a-task → `{gateway}/desk/queue` / `/desk/upload`), `storage.ts`
(SecureStore pairing), `queue.ts`. Background audio via
`UIBackgroundModes: ["audio"]`. **Dev builds only** — WebRTC can't run in Expo Go.

## Health (`src/health/`)

A port of the My OS: Health web app, on the same backend and encryption format.

- `model/` — the app state `D` and every rule the web has: series, cycle,
  experiments (`ruleHit`), reminders (`remDone`, `nextFire`), plans, teeth
  geometry, chart maths, stories, the sample data. **Ported exactly**: the web
  and the phone must agree on what counts as done.
- `store/supabase.ts` — faithful port of `myos-health/store/supabase.js`:
  the same app-state ↔ row mapping, diff-based save (only changed rows,
  deletes for rows that vanished), conflict keys, 1000-row paging, imported
  rows kept out of the manual diff. `store/sampleStore.ts` keeps fictional
  data on the phone for exploring without an account.
- `store/crypto.ts` — the photo vault, byte-for-byte compatible with the web:
  PBKDF2-SHA256 600k iterations (native, `react-native-quick-crypto`) →
  AES-256-GCM (native, `expo-crypto`), `iv(12) || ct || tag(16)`. The derived
  key lives in the keychain; decrypted files live only in a cache folder wiped
  on lock / sign-out. `store/session.ts` keeps the Supabase session AES-encrypted
  in AsyncStorage with a keychain key (sessions are too big for SecureStore).
- `screens/` — Dashboard (stories, body with points and scrubber, head
  close-up, tooth chart, widgets), Timeline, Appointments, Plan (experiments
  with their own page, yearly plan by category, reminders), Charts (SVG, two
  kinds), Labs, Photos, Lifestyle, Reports (CSV via the share sheet).
- `sheets/` — every form and detail view, opened in the one bottom sheet.
  Camera capture shows a faint overlay of the last photo in that series.
- `notifications/reminders.ts` — reminders → local notifications, no push
  server. Reconciled on every save and app open: ≤60 pending, next 7 days,
  private ones say only "My OS Health: time for a check-in", skipped when the
  target is already done that day. Permission is asked on the first reminder
  saved, never at install.
- `healthkit/sync.ts` — Apple Health, read-only, through
  `@kingstinct/react-native-healthkit`: daily values → `daily_metrics`, flow
  and symptoms → `cycle_days`, workouts → `regimen_logs` for Lifestyle items
  that opted in. Written through a separate import path that only touches
  `source='apple_health'` rows.
- Security: only the publishable key ever ships; the database refuses any
  session below `aal2` once a two-step factor is enrolled, so the app always
  shows the code prompt rather than an empty record; health content is covered
  in the app switcher; no health value ever goes into a notification or a log.

## Stack

Expo SDK 57 (React Native 0.86, TypeScript) · `@elevenlabs/react-native` +
LiveKit WebRTC at latest (ahead of the ElevenLabs peer range on purpose: the
older LiveKit still calls `jcenter()`, which Expo 57's Gradle removed;
`.npmrc` carries `legacy-peer-deps=true`) · `@supabase/supabase-js` +
`react-native-url-polyfill` · `react-native-svg` · `expo-camera`, `expo-image`,
`expo-image-manipulator`, `expo-document-picker`, `expo-sharing`,
`expo-notifications`, `expo-font` (Manrope + DM Mono) ·
`react-native-quick-crypto` + `react-native-nitro-modules` ·
`@kingstinct/react-native-healthkit` (HealthKit entitlement, read-only).
`modules/subject-mask` (local Expo module, v2.1: Vision subject cutout for body and
face photos, on the phone, iOS 17+).

New native modules since v1.2 → a **new binary** (`eas build`) is required;
an OTA update cannot carry them.

## Scripts

`npm start` (dev client) · `npx tsc --noEmit` · `npx expo export --platform ios`
(bundle check) · `eas build --platform ios --profile production` ·
`eas submit`.

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md). Free to read, build and use for yourself, a household, or a noncommercial organization. Selling it, or publishing it as an app or service, needs permission.
