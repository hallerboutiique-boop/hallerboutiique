# Haller Ordini

App amministrativa iOS e Android di Haller Boutique, sviluppata con Expo SDK 57 e React Native.

## Sviluppo

```bash
pnpm install --ignore-workspace
pnpm start
```

Controlli disponibili:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/expo install --check
./node_modules/.bin/expo config --type public
```

## Build native e notifiche

```bash
eas login
eas init
eas build --profile development --platform all
```

Le notifiche remote richiedono una build nativa. La configurazione usa il canale Android `orders` e abilita `remote-notification` su iOS. EAS richiederà le credenziali FCM V1 per Android e APNs per iOS.

L'app legge il backend da `EXPO_PUBLIC_API_BASE_URL` oppure da `expo.extra.apiBaseUrl` in `app.json`.
