# Haller Boutique

Sito statico per Haller Boutique, costruito sul riferimento grafico fornito.

- Prima diapositiva ricavata dal mockup originale
- Seconda diapositiva con la foto della modella caricata
- Consegna a Milano in 3-4 ore in base alla distanza, anche meno; fuori Milano entro 24 ore
- Logo originale estratto dal riferimento
- Palette oro allineata alla scritta della slide donna
- Footer con icone Instagram, TikTok e Telegram
- Slide uomo e donna con testo `LUSSO QUALITÀ STILE` senza punti
- Responsive mobile ottimizzato per viewport stretti
- Pagina checkout con contrassegno e pagamento crypto tracciabile
- Campo codice sconto nel checkout con pulsante rifinito
- Label checkout allineate ai campi
- Catalogo completo Uomo e Donna con schede prodotto, sconti, taglie e placeholder immagini
- Registrazione utenti con email/password, cellulare facoltativo e pannello admin utenti
- Route pronte per login Google e Microsoft tramite credenziali OAuth
- Dashboard admin con visite live, storico visite, IP completi in area admin, checkout abbandonati, conversione, ordini, incassi, dispositivi, browser, pagine, sorgenti e prodotti piu venduti
- Banner consenso cookie con opzioni necessari, metriche e replay sessione
- Raccolta posizione precisa del dispositivo tramite popup browser e consenso dedicato
- Banner centrale sotto hero per attivare localizzazione e tempi di consegna in tempo reale
- Video replay sessione in admin con pagina web dentro al player, mouse, click, scroll, resize e input mascherati
- Tracking anonimo first-party per utenti Safari/iOS con cookie server HttpOnly dopo consenso
- Rilevamento modello dispositivo, sistema operativo, versione OS, browser, schermo e viewport quando disponibili
- Storico analytics conservato fino a 365 giorni con modello dispositivo, IP completo in area admin e localizzazione IP per citta/paese quando disponibile
- Coordinate GPS e accuratezza in metri visibili in admin quando l'utente autorizza la posizione precisa
- Storico visite admin diviso in categorie: sessione, dispositivo, rete, posizione e comportamento
- App amministrativa iOS e Android con notifiche push, gestione stato ordini e riepilogo incassi

## App Haller Ordini

L'app Expo/React Native si trova in `mobile/` e usa il backend del sito come unica fonte dati.

Funzioni incluse:

- notifica push persistente per ogni nuovo ordine, visibile anche con l'app in background o chiusa;
- accesso con la password `ADMIN_PASSWORD` del sito e token mobile firmato valido 30 giorni;
- elenco filtrabile di ordini nuovi, confermati e rifiutati;
- dettaglio cliente, indirizzo, prodotti, taglie, pagamento, sconto e transazione;
- conferma o rifiuto dell'ordine; il rifiuto ripristina l'inventario;
- incassi basati soltanto sugli ordini confermati, con totale giornaliero, ordine medio e andamento mensile;
- token push salvati sul volume persistente in `push-subscriptions.json` e ritentativi automatici delle notifiche non consegnate.

### Avvio locale dell'app

```bash
cd mobile
pnpm install --ignore-workspace
pnpm start
```

Le notifiche push remote richiedono una development build o una build EAS; su Android non funzionano dentro Expo Go. Prima della prima build:

```bash
cd mobile
eas login
eas init
eas build --profile development --platform all
```

`eas init` collega il progetto e aggiunge il `projectId` usato per generare gli Expo Push Token. Per Android occorre configurare FCM V1; per iOS EAS può creare la chiave APNs durante la procedura guidata.

L'URL predefinito del backend è `https://www.hallerboutiique.com`. Per un ambiente diverso si può impostare `EXPO_PUBLIC_API_BASE_URL` partendo da `mobile/.env.example`.

### API mobile

- `POST /api/mobile/admin/login`
- `GET /api/mobile/admin/orders`
- `GET|PATCH /api/mobile/admin/orders/:id`
- `GET /api/mobile/admin/dashboard`
- `POST|DELETE /api/mobile/admin/push-token`

Tutte le route tranne il login richiedono `Authorization: Bearer <token>`.
