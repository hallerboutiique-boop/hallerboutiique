const slides = Array.from(document.querySelectorAll(".hero-slide"));
const heroSlider = document.querySelector(".hero-slider");
let active = 0;
let tryOnProduct = null;
let tryOnPreviewUrl = "";
let bundleTryOnPreviewUrl = "";
let bundleTryOnItems = [];
let revealObserver = null;
let siteMotionEnabled = false;
let motionEventsBound = false;
let motionScrollFrame = 0;
let motionScrollDirection = "down";
let lastMotionScrollY = window.scrollY;
let siteLanguage = localStorage.getItem("haller-language") || "it";

const translations = {
  it: {
    "meta-description": "Haller Boutique: lusso, qualita e stile.", search: "Cerca", "go-checkout": "Vai al checkout", "change-language": "Cambia lingua", "main-menu": "Menu principale", home: "Home", "new-arrivals": "Nuovi arrivi", men: "Uomo", women: "Donna", "hero-title": "LUSSO<br>QUALITA<br>STILE", "hero-description": "Scopri le ultime novita<br>delle migliori marche.", "discover-now": "Scopri ora", "payment-title": "Pagamento alla consegna e crypto", "payment-description": "Contrassegno o crypto<br>in sicurezza", "support-title": "Assistenza H24", "support-description": "Siamo sempre<br>disponibili", "location-banner": "Consenti localizzazione per scoprire tempi di consegna in tempo reale.", selection: "Selezione", info: "Info", "whatsapp-support": "Assistenza WhatsApp", shipping: "Spedizioni", terms: "Termini e condizioni", "follow-social": "Seguici sui nostri social", copyright: "Copyright 2017 Haller Boutique. Tutti i diritti riservati.", sizes: "Taglie", price: "Prezzo", "add-cart": "Aggiungi al carrello", "buy-now": "Acquista ora", "try-on": "Indossa", "image-placeholder": "Immagine in arrivo"
  },
  en: {
    "meta-description": "Haller Boutique: luxury, quality and style.", search: "Search", "go-checkout": "Go to checkout", "change-language": "Change language", "main-menu": "Main menu", home: "Home", "new-arrivals": "New arrivals", men: "Men", women: "Women", "hero-title": "Luxury<br>Quality<br>Style", "hero-description": "Discover the latest arrivals<br>from the finest brands.", "discover-now": "Discover now", "payment-title": "Cash on delivery and crypto", "payment-description": "Cash on delivery or crypto<br>with confidence", "support-title": "24/7 Support", "support-description": "We are always<br>here for you", "location-banner": "Allow location to discover real-time delivery times.", selection: "Selection", info: "Info", "whatsapp-support": "WhatsApp support", shipping: "Shipping", terms: "Terms and conditions", "follow-social": "Follow us on social media", copyright: "Copyright 2017 Haller Boutique. All rights reserved.", sizes: "Sizes", price: "Price", "add-cart": "Add to cart", "buy-now": "Buy now", "try-on": "Try it on", "image-placeholder": "Image coming soon"
  },
  fr: {
    "meta-description": "Haller Boutique : luxe, qualite et style.", search: "Rechercher", "go-checkout": "Aller au paiement", "change-language": "Changer de langue", "main-menu": "Menu principal", home: "Accueil", "new-arrivals": "Nouveautes", men: "Homme", women: "Femme", "hero-title": "Luxe<br>Qualite<br>Style", "hero-description": "Decouvrez les dernieres nouveautes<br>des meilleures marques.", "discover-now": "Decouvrir", "payment-title": "Paiement a la livraison et crypto", "payment-description": "Paiement a la livraison ou crypto<br>en toute securite", "support-title": "Assistance 24h/24", "support-description": "Nous sommes toujours<br>disponibles", "location-banner": "Autorisez la localisation pour connaitre les delais de livraison en temps reel.", selection: "Selection", info: "Infos", "whatsapp-support": "Assistance WhatsApp", shipping: "Livraison", terms: "Conditions generales", "follow-social": "Suivez-nous sur les reseaux sociaux", copyright: "Copyright 2017 Haller Boutique. Tous droits reserves.", sizes: "Tailles", price: "Prix", "add-cart": "Ajouter au panier", "buy-now": "Acheter", "try-on": "Essayer", "image-placeholder": "Image bientot disponible"
  },
  de: {
    "meta-description": "Haller Boutique: Luxus, Qualitat und Stil.", search: "Suchen", "go-checkout": "Zur Kasse", "change-language": "Sprache andern", "main-menu": "Hauptmenu", home: "Startseite", "new-arrivals": "Neu eingetroffen", men: "Herren", women: "Damen", "hero-title": "Luxus<br>Qualitat<br>Stil", "hero-description": "Entdecken Sie die neuesten Artikel<br>der besten Marken.", "discover-now": "Jetzt entdecken", "payment-title": "Nachnahme und Krypto", "payment-description": "Nachnahme oder Krypto<br>sicher bezahlen", "support-title": "Support rund um die Uhr", "support-description": "Wir sind immer<br>fur Sie da", "location-banner": "Erlauben Sie den Standort, um Lieferzeiten in Echtzeit zu sehen.", selection: "Auswahl", info: "Info", "whatsapp-support": "WhatsApp-Support", shipping: "Versand", terms: "Allgemeine Geschaftsbedingungen", "follow-social": "Folgen Sie uns auf Social Media", copyright: "Copyright 2017 Haller Boutique. Alle Rechte vorbehalten.", sizes: "Grossen", price: "Preis", "add-cart": "In den Warenkorb", "buy-now": "Jetzt kaufen", "try-on": "Anprobieren", "image-placeholder": "Bild folgt"
  },
  es: {
    "meta-description": "Haller Boutique: lujo, calidad y estilo.", search: "Buscar", "go-checkout": "Ir al pago", "change-language": "Cambiar idioma", "main-menu": "Menu principal", home: "Inicio", "new-arrivals": "Novedades", men: "Hombre", women: "Mujer", "hero-title": "Lujo<br>Calidad<br>Estilo", "hero-description": "Descubre las ultimas novedades<br>de las mejores marcas.", "discover-now": "Descubrir ahora", "payment-title": "Pago contra reembolso y cripto", "payment-description": "Contra reembolso o cripto<br>con seguridad", "support-title": "Asistencia 24/7", "support-description": "Siempre estamos<br>disponibles", "location-banner": "Permite la ubicacion para ver los plazos de entrega en tiempo real.", selection: "Seleccion", info: "Info", "whatsapp-support": "Asistencia WhatsApp", shipping: "Envios", terms: "Terminos y condiciones", "follow-social": "Siguenos en redes sociales", copyright: "Copyright 2017 Haller Boutique. Todos los derechos reservados.", sizes: "Tallas", price: "Precio", "add-cart": "Anadir al carrito", "buy-now": "Comprar ahora", "try-on": "Probar", "image-placeholder": "Imagen proximamente"
  }
};

const interfaceTranslations = {
  it: {
    "sizes-available": "Taglie disponibili", added: "Aggiunto",
    "cookie-label": "Preferenze cookie", "cookie-kicker": "Privacy Haller Boutique", "cookie-title": "Cookie, sessione e posizione",
    "cookie-description": "Usiamo cookie tecnici per far funzionare il sito. Con il tuo consenso possiamo raccogliere metriche, replay sessione e posizione precisa del dispositivo per sicurezza, ordini e analisi visite. Password, pagamenti e valori dei campi non vengono registrati.",
    "cookie-required": "Necessari", "cookie-required-description": "Carrello, checkout, login e preferenza consenso.",
    "cookie-analytics": "Metriche sito", "cookie-analytics-description": "Visite, dispositivo, browser, pagine, conversione.",
    "cookie-replay": "Replay sessione", "cookie-replay-description": "Movimenti, click e scroll mascherando gli input.",
    "cookie-location": "Posizione precisa", "cookie-location-description": "Coordinate GPS, accuratezza in metri e orario, solo se autorizzi il popup del browser.",
    "cookie-necessary-only": "Solo necessari", "cookie-metrics-only": "Solo metriche", "cookie-customize": "Personalizza", "cookie-save": "Salva preferenze", "cookie-accept-all": "Accetta tutto",
    "chat-label": "Assistente virtuale Haller Boutique", "chat-open": "Apri assistente virtuale", "chat-close": "Chiudi assistente virtuale",
    "chat-avatar-alt": "Ritratto di Aurora, assistente virtuale", "chat-online": "Online", "chat-status": "Assistente online",
    "chat-intro": "Prima di iniziare, lasciami i tuoi dati per seguirti meglio.", "first-name": "Nome", "last-name": "Cognome", email: "Email", phone: "Cellulare", optional: "facoltativo",
    "chat-privacy": "I dati vengono usati solo per offrirti assistenza in questa conversazione.", "chat-start": "Inizia la chat",
    "chat-sizes": "Taglie", "chat-track-order": "Segui ordine", "chat-prompt-sizes": "Mi aiuti a scegliere la taglia?", "chat-prompt-order": "Vorrei sapere dove si trova il mio ordine. Il mio codice e HB-",
    "chat-placeholder": "Scrivi qui...", "chat-send": "Invia messaggio", "chat-greeting": "Ciao {name}, sono Aurora, l'assistente virtuale di Haller Boutique. Come posso aiutarti?", "chat-thinking": "Un attimo, controllo.", "chat-error": "Non riesco a rispondere ora.",
    "location-help-apple": "Se non vedi il popup, abilita Localizzazione per il browser nelle impostazioni Apple e tocca per riprovare.", "location-help-browser": "Se non vedi il popup, abilita Posizione dalle impostazioni del browser e tocca per riprovare.", "location-https": "Apri il sito in HTTPS per autorizzare la posizione.", "location-unsupported": "Questo browser non supporta la localizzazione. Apri il sito da Safari o Chrome.", "location-authorize": "Autorizza la posizione nel popup del browser.", "location-unavailable": "Posizione non disponibile. Riprova tra poco.", "location-active": "Localizzazione attiva. Tempi di consegna in tempo reale{accuracy}.", "location-denied": "Permesso posizione negato. Clicca sul lucchetto del sito e imposta Posizione su Consenti.", "location-gps": "Posizione non disponibile. Attiva il GPS del dispositivo e tocca per riprovare.", "location-error": "Errore posizione. Tocca per riprovare.", "location-retry": "Posizione non disponibile. Tocca per riprovare.",
    "checkout-to-confirm": "Da confermare", "checkout-to-fill": "Da compilare", copied: "Copiato", "copy-this-text": "Copia questo testo", "wallet-missing": "Wallet mancante", cod: "Contrassegno", "crypto-note": "Invia pagamento crypto e poi manda TX hash con codice ordine.", "no-online-payment": "Nessun pagamento online richiesto in questa fase.", "confirming-order": "Conferma in corso", "order-not-saved": "Ordine non salvato.", "order-confirmed": "Ordine confermato", "order-confirmed-note": "Ordine {code} confermato. Totale {total}.", "order-save-failed": "Non siamo riusciti a salvare l'ordine.", "discount-applied": "Codice sconto inserito. Lo verificheremo alla conferma dell'ordine.", "discount-empty": "Inserisci un codice sconto prima di applicarlo.",
    "tryon-close": "Chiudi try-on", "tryon-product": "Prova il prodotto", "tryon-product-name": "Prova {product}", "tryon-description": "Carica una tua foto frontale per generare l'anteprima.", "tryon-upload": "Carica foto", "tryon-result-empty": "Il risultato comparira qui.", "tryon-consent": "Autorizzo il salvataggio privato della foto e dell'anteprima per 30 giorni, per poterle recuperare dall'assistenza.", "tryon-generate": "Genera prova AI", "tryon-progress": "Avanzamento try-on AI", "tryon-upload-preview": "Carica una tua foto per vedere l'anteprima.", "tryon-loaded-alt": "Foto caricata per try-on", "tryon-loaded": "Foto caricata. Premi Genera prova AI.", "tryon-image-missing": "Immagine del prodotto non disponibile.", "tryon-upload-first": "Carica prima una tua foto.", "tryon-preparing": "Preparazione del capo reale", "tryon-preparing-ai": "Sto preparando l'anteprima AI...", "tryon-inputs-ready": "Foto cliente e capo del catalogo pronti", "tryon-sending": "Invio foto al server...", "tryon-ready": "Anteprima pronta", "tryon-ready-saved": "Anteprima pronta e archiviata per 30 giorni.", "tryon-generation-failed": "Generazione non riuscita", "tryon-result-failed": "Non siamo riusciti a generare l'anteprima.", "tryon-unavailable": "Try-on non disponibile."
  },
  en: {
    "sizes-available": "Available sizes", added: "Added",
    "cookie-label": "Cookie preferences", "cookie-kicker": "Haller Boutique privacy", "cookie-title": "Cookies, sessions and location",
    "cookie-description": "We use essential cookies to operate the site. With your consent, we can collect analytics, session replays and precise device location for security, orders and visit analysis. Passwords, payments and form values are never recorded.",
    "cookie-required": "Essential", "cookie-required-description": "Cart, checkout, sign-in and consent preference.",
    "cookie-analytics": "Site analytics", "cookie-analytics-description": "Visits, device, browser, pages and conversion.",
    "cookie-replay": "Session replay", "cookie-replay-description": "Movements, clicks and scrolling with inputs masked.",
    "cookie-location": "Precise location", "cookie-location-description": "GPS coordinates, accuracy and time, only after you approve the browser prompt.",
    "cookie-necessary-only": "Essential only", "cookie-metrics-only": "Analytics only", "cookie-customize": "Customize", "cookie-save": "Save preferences", "cookie-accept-all": "Accept all",
    "chat-label": "Haller Boutique virtual assistant", "chat-open": "Open virtual assistant", "chat-close": "Close virtual assistant",
    "chat-avatar-alt": "Portrait of Aurora, virtual assistant", "chat-online": "Online", "chat-status": "Assistant online",
    "chat-intro": "Before we start, leave your details so I can assist you better.", "first-name": "First name", "last-name": "Last name", email: "Email", phone: "Phone", optional: "optional",
    "chat-privacy": "Your details are used only to assist you in this conversation.", "chat-start": "Start chat",
    "chat-sizes": "Sizes", "chat-track-order": "Track order", "chat-prompt-sizes": "Can you help me choose the right size?", "chat-prompt-order": "I would like to track my order. My code is HB-",
    "chat-placeholder": "Type here...", "chat-send": "Send message", "chat-greeting": "Hi {name}, I'm Aurora, Haller Boutique's virtual assistant. How can I help?", "chat-thinking": "One moment, I'm checking.", "chat-error": "I can't reply right now.",
    "location-help-apple": "If the prompt does not appear, enable Location Services for your browser in Apple settings and tap to try again.", "location-help-browser": "If the prompt does not appear, enable Location in your browser settings and tap to try again.", "location-https": "Open the site over HTTPS to allow location access.", "location-unsupported": "This browser does not support location. Open the site in Safari or Chrome.", "location-authorize": "Allow location in the browser prompt.", "location-unavailable": "Location is unavailable. Try again shortly.", "location-active": "Location is active. Real-time delivery estimates are available{accuracy}.", "location-denied": "Location permission was denied. Open the site lock icon and set Location to Allow.", "location-gps": "Location is unavailable. Enable your device GPS and tap to try again.", "location-error": "Location error. Tap to try again.", "location-retry": "Location is unavailable. Tap to try again.",
    "checkout-to-confirm": "To be confirmed", "checkout-to-fill": "To be completed", copied: "Copied", "copy-this-text": "Copy this text", "wallet-missing": "Wallet missing", cod: "Cash on delivery", "crypto-note": "Send the crypto payment, then submit the TX hash with your order code.", "no-online-payment": "No online payment is required at this stage.", "confirming-order": "Confirming order", "order-not-saved": "Order not saved.", "order-confirmed": "Order confirmed", "order-confirmed-note": "Order {code} confirmed. Total {total}.", "order-save-failed": "We could not save the order.", "discount-applied": "Discount code entered. We will verify it when the order is confirmed.", "discount-empty": "Enter a discount code before applying it.",
    "tryon-close": "Close try-on", "tryon-product": "Try on the product", "tryon-product-name": "Try on {product}", "tryon-description": "Upload a front-facing photo to generate the preview.", "tryon-upload": "Upload photo", "tryon-result-empty": "The result will appear here.", "tryon-consent": "I authorize private storage of the photo and preview for 30 days so support can retrieve them.", "tryon-generate": "Generate AI try-on", "tryon-progress": "AI try-on progress", "tryon-upload-preview": "Upload your photo to see the preview.", "tryon-loaded-alt": "Photo uploaded for try-on", "tryon-loaded": "Photo uploaded. Select Generate AI try-on.", "tryon-image-missing": "The product image is unavailable.", "tryon-upload-first": "Upload your photo first.", "tryon-preparing": "Preparing the real garment", "tryon-preparing-ai": "Preparing the AI preview...", "tryon-inputs-ready": "Customer photo and catalog garment are ready", "tryon-sending": "Sending the photo to the server...", "tryon-ready": "Preview ready", "tryon-ready-saved": "Preview ready and archived for 30 days.", "tryon-generation-failed": "Generation failed", "tryon-result-failed": "We could not generate the preview.", "tryon-unavailable": "Try-on is unavailable."
  },
  fr: {
    "sizes-available": "Tailles disponibles", added: "Ajoute",
    "cookie-label": "Preferences de cookies", "cookie-kicker": "Confidentialite Haller Boutique", "cookie-title": "Cookies, sessions et localisation",
    "cookie-description": "Nous utilisons des cookies essentiels au fonctionnement du site. Avec votre accord, nous pouvons recueillir des statistiques, des relectures de session et la position precise de l'appareil pour la securite, les commandes et l'analyse des visites. Les mots de passe, paiements et valeurs des champs ne sont jamais enregistres.",
    "cookie-required": "Essentiels", "cookie-required-description": "Panier, paiement, connexion et preference de consentement.",
    "cookie-analytics": "Statistiques du site", "cookie-analytics-description": "Visites, appareil, navigateur, pages et conversion.",
    "cookie-replay": "Relecture de session", "cookie-replay-description": "Mouvements, clics et defilement avec les champs masques.",
    "cookie-location": "Position precise", "cookie-location-description": "Coordonnees GPS, precision et heure, uniquement apres votre accord dans le navigateur.",
    "cookie-necessary-only": "Essentiels uniquement", "cookie-metrics-only": "Statistiques uniquement", "cookie-customize": "Personnaliser", "cookie-save": "Enregistrer", "cookie-accept-all": "Tout accepter",
    "chat-label": "Assistant virtuel Haller Boutique", "chat-open": "Ouvrir l'assistant virtuel", "chat-close": "Fermer l'assistant virtuel",
    "chat-avatar-alt": "Portrait d'Aurora, assistante virtuelle", "chat-online": "En ligne", "chat-status": "Assistante en ligne",
    "chat-intro": "Avant de commencer, laissez-moi vos coordonnees pour mieux vous accompagner.", "first-name": "Prenom", "last-name": "Nom", email: "E-mail", phone: "Telephone", optional: "facultatif",
    "chat-privacy": "Vos donnees servent uniquement a vous assister pendant cette conversation.", "chat-start": "Demarrer le chat",
    "chat-sizes": "Tailles", "chat-track-order": "Suivre la commande", "chat-prompt-sizes": "Pouvez-vous m'aider a choisir la bonne taille ?", "chat-prompt-order": "Je souhaite suivre ma commande. Mon code est HB-",
    "chat-placeholder": "Ecrivez ici...", "chat-send": "Envoyer le message", "chat-greeting": "Bonjour {name}, je suis Aurora, l'assistante virtuelle de Haller Boutique. Comment puis-je vous aider ?", "chat-thinking": "Un instant, je verifie.", "chat-error": "Je ne peux pas repondre pour le moment.",
    "location-help-apple": "Si la fenetre ne s'affiche pas, activez la localisation du navigateur dans les reglages Apple et touchez pour reessayer.", "location-help-browser": "Si la fenetre ne s'affiche pas, activez la localisation dans les reglages du navigateur et touchez pour reessayer.", "location-https": "Ouvrez le site en HTTPS pour autoriser la localisation.", "location-unsupported": "Ce navigateur ne prend pas en charge la localisation. Ouvrez le site dans Safari ou Chrome.", "location-authorize": "Autorisez la localisation dans la fenetre du navigateur.", "location-unavailable": "Localisation indisponible. Reessayez dans un instant.", "location-active": "Localisation active. Delais de livraison en temps reel disponibles{accuracy}.", "location-denied": "Autorisation de localisation refusee. Ouvrez le cadenas du site et autorisez la localisation.", "location-gps": "Localisation indisponible. Activez le GPS de l'appareil et touchez pour reessayer.", "location-error": "Erreur de localisation. Touchez pour reessayer.", "location-retry": "Localisation indisponible. Touchez pour reessayer.",
    "checkout-to-confirm": "A confirmer", "checkout-to-fill": "A completer", copied: "Copie", "copy-this-text": "Copier ce texte", "wallet-missing": "Wallet manquant", cod: "Paiement a la livraison", "crypto-note": "Envoyez le paiement crypto, puis transmettez le hash TX avec le numero de commande.", "no-online-payment": "Aucun paiement en ligne n'est requis a ce stade.", "confirming-order": "Confirmation en cours", "order-not-saved": "Commande non enregistree.", "order-confirmed": "Commande confirmee", "order-confirmed-note": "Commande {code} confirmee. Total {total}.", "order-save-failed": "Impossible d'enregistrer la commande.", "discount-applied": "Code promotionnel saisi. Il sera verifie lors de la confirmation.", "discount-empty": "Saisissez un code promotionnel avant de l'appliquer.",
    "tryon-close": "Fermer l'essayage", "tryon-product": "Essayer le produit", "tryon-product-name": "Essayer {product}", "tryon-description": "Importez une photo de face pour generer l'aperçu.", "tryon-upload": "Importer une photo", "tryon-result-empty": "Le resultat apparaitra ici.", "tryon-consent": "J'autorise la conservation privee de la photo et de l'aperçu pendant 30 jours afin que l'assistance puisse les recuperer.", "tryon-generate": "Generer l'essayage IA", "tryon-progress": "Progression de l'essayage IA", "tryon-upload-preview": "Importez votre photo pour voir l'aperçu.", "tryon-loaded-alt": "Photo importee pour l'essayage", "tryon-loaded": "Photo importee. Selectionnez Generer l'essayage IA.", "tryon-image-missing": "L'image du produit est indisponible.", "tryon-upload-first": "Importez d'abord votre photo.", "tryon-preparing": "Preparation du vetement reel", "tryon-preparing-ai": "Preparation de l'aperçu IA...", "tryon-inputs-ready": "Photo client et vetement du catalogue prets", "tryon-sending": "Envoi de la photo au serveur...", "tryon-ready": "Aperçu pret", "tryon-ready-saved": "Aperçu pret et archive pendant 30 jours.", "tryon-generation-failed": "Echec de la generation", "tryon-result-failed": "Impossible de generer l'aperçu.", "tryon-unavailable": "L'essayage est indisponible."
  },
  de: {
    "sizes-available": "Verfugbare Grossen", added: "Hinzugefugt",
    "cookie-label": "Cookie-Einstellungen", "cookie-kicker": "Datenschutz bei Haller Boutique", "cookie-title": "Cookies, Sitzungen und Standort",
    "cookie-description": "Wir verwenden notwendige Cookies fur den Betrieb der Website. Mit Ihrer Einwilligung konnen wir Statistiken, Sitzungswiedergaben und den genauen Geratestandort fur Sicherheit, Bestellungen und Besuchsanalysen erfassen. Passworter, Zahlungen und Formulareingaben werden nie aufgezeichnet.",
    "cookie-required": "Notwendig", "cookie-required-description": "Warenkorb, Kasse, Anmeldung und Einwilligungseinstellung.",
    "cookie-analytics": "Website-Statistiken", "cookie-analytics-description": "Besuche, Gerat, Browser, Seiten und Konversion.",
    "cookie-replay": "Sitzungswiedergabe", "cookie-replay-description": "Bewegungen, Klicks und Scrollen bei maskierten Eingaben.",
    "cookie-location": "Genauer Standort", "cookie-location-description": "GPS-Koordinaten, Genauigkeit und Uhrzeit, nur nach Zustimmung im Browser.",
    "cookie-necessary-only": "Nur notwendige", "cookie-metrics-only": "Nur Statistiken", "cookie-customize": "Anpassen", "cookie-save": "Einstellungen speichern", "cookie-accept-all": "Alle akzeptieren",
    "chat-label": "Virtueller Assistent von Haller Boutique", "chat-open": "Virtuellen Assistenten offnen", "chat-close": "Virtuellen Assistenten schliessen",
    "chat-avatar-alt": "Portrat von Aurora, virtueller Assistent", "chat-online": "Online", "chat-status": "Assistent online",
    "chat-intro": "Hinterlassen Sie vor dem Start Ihre Daten, damit ich Sie besser unterstutzen kann.", "first-name": "Vorname", "last-name": "Nachname", email: "E-Mail", phone: "Telefon", optional: "optional",
    "chat-privacy": "Ihre Daten werden nur fur die Unterstutzung in diesem Gesprach verwendet.", "chat-start": "Chat starten",
    "chat-sizes": "Grossen", "chat-track-order": "Bestellung verfolgen", "chat-prompt-sizes": "Konnen Sie mir bei der Wahl der richtigen Grosse helfen?", "chat-prompt-order": "Ich mochte meine Bestellung verfolgen. Mein Code lautet HB-",
    "chat-placeholder": "Hier schreiben...", "chat-send": "Nachricht senden", "chat-greeting": "Hallo {name}, ich bin Aurora, der virtuelle Assistent von Haller Boutique. Wie kann ich helfen?", "chat-thinking": "Einen Moment, ich prufe das.", "chat-error": "Ich kann gerade nicht antworten.",
    "location-help-apple": "Wenn die Abfrage nicht erscheint, aktivieren Sie die Ortungsdienste fur den Browser in den Apple-Einstellungen und tippen Sie erneut.", "location-help-browser": "Wenn die Abfrage nicht erscheint, aktivieren Sie den Standort in den Browser-Einstellungen und tippen Sie erneut.", "location-https": "Offnen Sie die Website uber HTTPS, um den Standort freizugeben.", "location-unsupported": "Dieser Browser unterstutzt keinen Standort. Offnen Sie die Website in Safari oder Chrome.", "location-authorize": "Erlauben Sie den Standort in der Browser-Abfrage.", "location-unavailable": "Standort nicht verfugbar. Versuchen Sie es gleich erneut.", "location-active": "Standort aktiv. Lieferzeiten in Echtzeit sind verfugbar{accuracy}.", "location-denied": "Standortzugriff wurde abgelehnt. Offnen Sie das Schloss-Symbol und erlauben Sie den Standort.", "location-gps": "Standort nicht verfugbar. Aktivieren Sie das GPS und tippen Sie erneut.", "location-error": "Standortfehler. Tippen Sie erneut.", "location-retry": "Standort nicht verfugbar. Tippen Sie erneut.",
    "checkout-to-confirm": "Noch zu bestatigen", "checkout-to-fill": "Noch auszufullen", copied: "Kopiert", "copy-this-text": "Diesen Text kopieren", "wallet-missing": "Wallet fehlt", cod: "Nachnahme", "crypto-note": "Senden Sie die Krypto-Zahlung und danach den TX-Hash mit der Bestellnummer.", "no-online-payment": "In diesem Schritt ist keine Online-Zahlung erforderlich.", "confirming-order": "Bestellung wird bestatigt", "order-not-saved": "Bestellung nicht gespeichert.", "order-confirmed": "Bestellung bestatigt", "order-confirmed-note": "Bestellung {code} bestatigt. Gesamt {total}.", "order-save-failed": "Die Bestellung konnte nicht gespeichert werden.", "discount-applied": "Rabattcode eingegeben. Er wird bei der Bestatigung gepruft.", "discount-empty": "Geben Sie vor dem Anwenden einen Rabattcode ein.",
    "tryon-close": "Anprobe schliessen", "tryon-product": "Produkt anprobieren", "tryon-product-name": "{product} anprobieren", "tryon-description": "Laden Sie ein frontales Foto hoch, um die Vorschau zu erstellen.", "tryon-upload": "Foto hochladen", "tryon-result-empty": "Das Ergebnis erscheint hier.", "tryon-consent": "Ich erlaube die private Speicherung von Foto und Vorschau fur 30 Tage, damit der Support sie abrufen kann.", "tryon-generate": "KI-Anprobe erstellen", "tryon-progress": "Fortschritt der KI-Anprobe", "tryon-upload-preview": "Laden Sie Ihr Foto fur die Vorschau hoch.", "tryon-loaded-alt": "Foto fur die Anprobe hochgeladen", "tryon-loaded": "Foto hochgeladen. Wahlen Sie KI-Anprobe erstellen.", "tryon-image-missing": "Das Produktbild ist nicht verfugbar.", "tryon-upload-first": "Laden Sie zuerst Ihr Foto hoch.", "tryon-preparing": "Reales Kleidungsstuck wird vorbereitet", "tryon-preparing-ai": "KI-Vorschau wird vorbereitet...", "tryon-inputs-ready": "Kundenfoto und Katalogartikel sind bereit", "tryon-sending": "Foto wird an den Server gesendet...", "tryon-ready": "Vorschau bereit", "tryon-ready-saved": "Vorschau bereit und 30 Tage archiviert.", "tryon-generation-failed": "Generierung fehlgeschlagen", "tryon-result-failed": "Die Vorschau konnte nicht erstellt werden.", "tryon-unavailable": "Die Anprobe ist nicht verfugbar."
  },
  es: {
    "sizes-available": "Tallas disponibles", added: "Anadido",
    "cookie-label": "Preferencias de cookies", "cookie-kicker": "Privacidad de Haller Boutique", "cookie-title": "Cookies, sesiones y ubicacion",
    "cookie-description": "Usamos cookies esenciales para que el sitio funcione. Con tu consentimiento podemos recopilar metricas, repeticiones de sesion y la ubicacion precisa del dispositivo para seguridad, pedidos y analisis de visitas. Nunca se registran contrasenas, pagos ni valores de formularios.",
    "cookie-required": "Esenciales", "cookie-required-description": "Carrito, pago, inicio de sesion y preferencia de consentimiento.",
    "cookie-analytics": "Metricas del sitio", "cookie-analytics-description": "Visitas, dispositivo, navegador, paginas y conversion.",
    "cookie-replay": "Repeticion de sesion", "cookie-replay-description": "Movimientos, clics y desplazamiento con los campos ocultos.",
    "cookie-location": "Ubicacion precisa", "cookie-location-description": "Coordenadas GPS, precision y hora, solo tras autorizarlo en el navegador.",
    "cookie-necessary-only": "Solo esenciales", "cookie-metrics-only": "Solo metricas", "cookie-customize": "Personalizar", "cookie-save": "Guardar preferencias", "cookie-accept-all": "Aceptar todo",
    "chat-label": "Asistente virtual de Haller Boutique", "chat-open": "Abrir asistente virtual", "chat-close": "Cerrar asistente virtual",
    "chat-avatar-alt": "Retrato de Aurora, asistente virtual", "chat-online": "En linea", "chat-status": "Asistente en linea",
    "chat-intro": "Antes de empezar, dejame tus datos para atenderte mejor.", "first-name": "Nombre", "last-name": "Apellidos", email: "Correo", phone: "Telefono", optional: "opcional",
    "chat-privacy": "Tus datos se usan solo para ayudarte durante esta conversacion.", "chat-start": "Iniciar chat",
    "chat-sizes": "Tallas", "chat-track-order": "Seguir pedido", "chat-prompt-sizes": "Puedes ayudarme a elegir la talla correcta?", "chat-prompt-order": "Quiero saber donde esta mi pedido. Mi codigo es HB-",
    "chat-placeholder": "Escribe aqui...", "chat-send": "Enviar mensaje", "chat-greeting": "Hola {name}, soy Aurora, la asistente virtual de Haller Boutique. En que puedo ayudarte?", "chat-thinking": "Un momento, lo compruebo.", "chat-error": "Ahora mismo no puedo responder.",
    "location-help-apple": "Si no aparece el aviso, activa Localizacion para el navegador en los ajustes de Apple y toca para volver a intentarlo.", "location-help-browser": "Si no aparece el aviso, activa Ubicacion en los ajustes del navegador y toca para volver a intentarlo.", "location-https": "Abre el sitio mediante HTTPS para permitir la ubicacion.", "location-unsupported": "Este navegador no admite ubicacion. Abre el sitio en Safari o Chrome.", "location-authorize": "Permite la ubicacion en el aviso del navegador.", "location-unavailable": "Ubicacion no disponible. Vuelve a intentarlo en breve.", "location-active": "Ubicacion activa. Plazos de entrega en tiempo real disponibles{accuracy}.", "location-denied": "Permiso de ubicacion denegado. Abre el candado del sitio y establece Ubicacion en Permitir.", "location-gps": "Ubicacion no disponible. Activa el GPS del dispositivo y vuelve a intentarlo.", "location-error": "Error de ubicacion. Toca para volver a intentarlo.", "location-retry": "Ubicacion no disponible. Toca para volver a intentarlo.",
    "checkout-to-confirm": "Por confirmar", "checkout-to-fill": "Por completar", copied: "Copiado", "copy-this-text": "Copia este texto", "wallet-missing": "Falta el wallet", cod: "Contra reembolso", "crypto-note": "Envia el pago en cripto y despues el hash TX con el codigo de pedido.", "no-online-payment": "No se requiere pago en linea en esta fase.", "confirming-order": "Confirmando pedido", "order-not-saved": "Pedido no guardado.", "order-confirmed": "Pedido confirmado", "order-confirmed-note": "Pedido {code} confirmado. Total {total}.", "order-save-failed": "No hemos podido guardar el pedido.", "discount-applied": "Codigo de descuento introducido. Se verificara al confirmar el pedido.", "discount-empty": "Introduce un codigo de descuento antes de aplicarlo.",
    "tryon-close": "Cerrar prueba", "tryon-product": "Probar el producto", "tryon-product-name": "Probar {product}", "tryon-description": "Sube una foto frontal para generar la vista previa.", "tryon-upload": "Subir foto", "tryon-result-empty": "El resultado aparecera aqui.", "tryon-consent": "Autorizo el almacenamiento privado de la foto y la vista previa durante 30 dias para que soporte pueda recuperarlas.", "tryon-generate": "Generar prueba con IA", "tryon-progress": "Progreso de la prueba con IA", "tryon-upload-preview": "Sube tu foto para ver la vista previa.", "tryon-loaded-alt": "Foto subida para la prueba", "tryon-loaded": "Foto subida. Selecciona Generar prueba con IA.", "tryon-image-missing": "La imagen del producto no esta disponible.", "tryon-upload-first": "Sube primero tu foto.", "tryon-preparing": "Preparando la prenda real", "tryon-preparing-ai": "Preparando la vista previa con IA...", "tryon-inputs-ready": "Foto del cliente y prenda del catalogo listas", "tryon-sending": "Enviando la foto al servidor...", "tryon-ready": "Vista previa lista", "tryon-ready-saved": "Vista previa lista y archivada durante 30 dias.", "tryon-generation-failed": "La generacion ha fallado", "tryon-result-failed": "No hemos podido generar la vista previa.", "tryon-unavailable": "La prueba no esta disponible."
  }
};

Object.entries(interfaceTranslations).forEach(([language, values]) => Object.assign(translations[language], values));

const bundleTryOnTranslations = {
  it: {
    "bundle-tryon-kicker": "Try-on bundle AI", "bundle-tryon-title": "Prova tutto il carrello", "bundle-tryon-description": "Una foto, un outfit completo con capi, scarpe e borse del tuo carrello.", "bundle-tryon-upload": "Carica la tua foto", "bundle-tryon-result-empty": "L'outfit completo comparira qui.", "bundle-tryon-generate": "Genera outfit completo", "bundle-tryon-progress": "Avanzamento try-on bundle AI", "bundle-tryon-empty": "Aggiungi almeno un articolo al carrello per creare il tuo outfit.", "bundle-tryon-loaded": "Foto caricata. Il bundle e pronto.", "bundle-tryon-preparing": "Preparazione di tutti gli articoli", "bundle-tryon-inputs-ready": "Foto cliente e bundle del carrello pronti", "bundle-tryon-ready": "Outfit completo pronto"
  },
  en: {
    "bundle-tryon-kicker": "AI bundle try-on", "bundle-tryon-title": "Try on your whole cart", "bundle-tryon-description": "One photo, one complete outfit with the clothing, shoes and bags in your cart.", "bundle-tryon-upload": "Upload your photo", "bundle-tryon-result-empty": "Your complete outfit will appear here.", "bundle-tryon-generate": "Generate complete outfit", "bundle-tryon-progress": "AI bundle try-on progress", "bundle-tryon-empty": "Add at least one item to your cart to create your outfit.", "bundle-tryon-loaded": "Photo uploaded. Your bundle is ready.", "bundle-tryon-preparing": "Preparing every item", "bundle-tryon-inputs-ready": "Customer photo and cart bundle are ready", "bundle-tryon-ready": "Complete outfit ready"
  },
  fr: {
    "bundle-tryon-kicker": "Essayage bundle IA", "bundle-tryon-title": "Essayez tout votre panier", "bundle-tryon-description": "Une photo, une tenue complete avec les vetements, chaussures et sacs de votre panier.", "bundle-tryon-upload": "Importer votre photo", "bundle-tryon-result-empty": "Votre tenue complete apparaitra ici.", "bundle-tryon-generate": "Generer la tenue complete", "bundle-tryon-progress": "Progression de l'essayage bundle IA", "bundle-tryon-empty": "Ajoutez au moins un article au panier pour creer votre tenue.", "bundle-tryon-loaded": "Photo importee. Votre bundle est pret.", "bundle-tryon-preparing": "Preparation de tous les articles", "bundle-tryon-inputs-ready": "Photo client et bundle du panier prets", "bundle-tryon-ready": "Tenue complete prete"
  },
  de: {
    "bundle-tryon-kicker": "KI-Bundle-Anprobe", "bundle-tryon-title": "Den ganzen Warenkorb anprobieren", "bundle-tryon-description": "Ein Foto, ein komplettes Outfit mit Kleidung, Schuhen und Taschen aus Ihrem Warenkorb.", "bundle-tryon-upload": "Foto hochladen", "bundle-tryon-result-empty": "Ihr komplettes Outfit erscheint hier.", "bundle-tryon-generate": "Komplettes Outfit erstellen", "bundle-tryon-progress": "Fortschritt der KI-Bundle-Anprobe", "bundle-tryon-empty": "Legen Sie mindestens einen Artikel in den Warenkorb, um Ihr Outfit zu erstellen.", "bundle-tryon-loaded": "Foto hochgeladen. Ihr Bundle ist bereit.", "bundle-tryon-preparing": "Alle Artikel werden vorbereitet", "bundle-tryon-inputs-ready": "Kundenfoto und Warenkorb-Bundle sind bereit", "bundle-tryon-ready": "Komplettes Outfit bereit"
  },
  es: {
    "bundle-tryon-kicker": "Prueba bundle con IA", "bundle-tryon-title": "Prueba todo tu carrito", "bundle-tryon-description": "Una foto, un conjunto completo con la ropa, zapatos y bolsos de tu carrito.", "bundle-tryon-upload": "Sube tu foto", "bundle-tryon-result-empty": "Tu conjunto completo aparecera aqui.", "bundle-tryon-generate": "Generar conjunto completo", "bundle-tryon-progress": "Progreso de la prueba bundle con IA", "bundle-tryon-empty": "Anade al menos un articulo al carrito para crear tu conjunto.", "bundle-tryon-loaded": "Foto subida. Tu bundle esta listo.", "bundle-tryon-preparing": "Preparando todos los articulos", "bundle-tryon-inputs-ready": "Foto del cliente y bundle del carrito listos", "bundle-tryon-ready": "Conjunto completo listo"
  }
};

Object.entries(bundleTryOnTranslations).forEach(([language, values]) => Object.assign(translations[language], values));

const catalogTranslations = {
  it: { "last-stock-nav": "Ultimi disponibili", "last-stock-warning": "Ultimo disponibile", "catalog-choose-category": "Scegli una categoria", "catalog-choose-brand": "Scegli una marca", "catalog-all-brands": "Tutte le marche", "catalog-all-products": "Tutti i modelli", "catalog-viewing": "Stai guardando", "catalog-search-title": "Cerca nel catalogo", "catalog-search-placeholder": "Modello, categoria o marca", "catalog-search-empty": "Nessun modello trovato.", "catalog-search-results": "Risultati ricerca", "catalog-close": "Chiudi", "catalog-last-title": "Ultimi disponibili", "catalog-last-description": "Gli articoli con un solo pezzo rimasto, organizzati per categoria e marca.", "catalog-last-empty": "Non ci sono ultimi pezzi da mostrare.", "catalog-last-choose": "Scegli il reparto", "catalog-back": "Torna alla selezione", "remove-cart-item": "Rimuovi dal carrello", "product-back": "Torna al catalogo", "product-details": "Dettagli prodotto", "product-description": "Selezionato da Haller Boutique per qualita, stile e cura dei dettagli.", "product-not-found": "Prodotto non trovato.", "gallery-previous": "Foto precedente", "gallery-next": "Foto successiva", "open-product": "Apri pagina prodotto" },
  en: { "last-stock-nav": "Last available", "last-stock-warning": "Last one available", "catalog-choose-category": "Choose a category", "catalog-choose-brand": "Choose a brand", "catalog-all-brands": "All brands", "catalog-all-products": "All styles", "catalog-viewing": "Viewing", "catalog-search-title": "Search the catalog", "catalog-search-placeholder": "Style, category or brand", "catalog-search-empty": "No styles found.", "catalog-search-results": "Search results", "catalog-close": "Close", "catalog-last-title": "Last available", "catalog-last-description": "Products with one piece left, organized by category and brand.", "catalog-last-empty": "There are no last pieces to show.", "catalog-last-choose": "Choose department", "catalog-back": "Back to selection", "remove-cart-item": "Remove from cart", "product-back": "Back to catalog", "product-details": "Product details", "product-description": "Selected by Haller Boutique for quality, style and attention to detail.", "product-not-found": "Product not found.", "gallery-previous": "Previous photo", "gallery-next": "Next photo", "open-product": "Open product page" },
  fr: { "last-stock-nav": "Dernieres pieces", "last-stock-warning": "Derniere piece disponible", "catalog-choose-category": "Choisissez une categorie", "catalog-choose-brand": "Choisissez une marque", "catalog-all-brands": "Toutes les marques", "catalog-all-products": "Tous les modeles", "catalog-viewing": "Vous regardez", "catalog-search-title": "Rechercher dans le catalogue", "catalog-search-placeholder": "Modele, categorie ou marque", "catalog-search-empty": "Aucun modele trouve.", "catalog-search-results": "Resultats de recherche", "catalog-close": "Fermer", "catalog-last-title": "Dernieres pieces", "catalog-last-description": "Les articles avec une seule piece restante, classes par categorie et marque.", "catalog-last-empty": "Aucune derniere piece a afficher.", "catalog-last-choose": "Choisissez le rayon", "catalog-back": "Retour a la selection", "remove-cart-item": "Retirer du panier", "product-back": "Retour au catalogue", "product-details": "Details du produit", "product-description": "Selectionne par Haller Boutique pour sa qualite, son style et ses finitions.", "product-not-found": "Produit introuvable.", "gallery-previous": "Photo precedente", "gallery-next": "Photo suivante", "open-product": "Ouvrir la page produit" },
  de: { "last-stock-nav": "Letzte verfugbare", "last-stock-warning": "Letztes verfugbar", "catalog-choose-category": "Kategorie auswahlen", "catalog-choose-brand": "Marke auswahlen", "catalog-all-brands": "Alle Marken", "catalog-all-products": "Alle Modelle", "catalog-viewing": "Sie sehen", "catalog-search-title": "Katalog durchsuchen", "catalog-search-placeholder": "Modell, Kategorie oder Marke", "catalog-search-empty": "Keine Modelle gefunden.", "catalog-search-results": "Suchergebnisse", "catalog-close": "Schliessen", "catalog-last-title": "Letzte verfugbare", "catalog-last-description": "Artikel mit einem verbleibenden Stuck, nach Kategorie und Marke sortiert.", "catalog-last-empty": "Keine letzten Stucke vorhanden.", "catalog-last-choose": "Bereich auswahlen", "catalog-back": "Zuruck zur Auswahl", "remove-cart-item": "Aus dem Warenkorb entfernen", "product-back": "Zuruck zum Katalog", "product-details": "Produktdetails", "product-description": "Von Haller Boutique wegen Qualitat, Stil und Details ausgewahlt.", "product-not-found": "Produkt nicht gefunden.", "gallery-previous": "Vorheriges Foto", "gallery-next": "Nachstes Foto", "open-product": "Produktseite offnen" },
  es: { "last-stock-nav": "Ultimos disponibles", "last-stock-warning": "Ultimo disponible", "catalog-choose-category": "Elige una categoria", "catalog-choose-brand": "Elige una marca", "catalog-all-brands": "Todas las marcas", "catalog-all-products": "Todos los modelos", "catalog-viewing": "Estas viendo", "catalog-search-title": "Buscar en el catalogo", "catalog-search-placeholder": "Modelo, categoria o marca", "catalog-search-empty": "No se han encontrado modelos.", "catalog-search-results": "Resultados de busqueda", "catalog-close": "Cerrar", "catalog-last-title": "Ultimos disponibles", "catalog-last-description": "Articulos con una sola unidad restante, organizados por categoria y marca.", "catalog-last-empty": "No hay ultimas unidades para mostrar.", "catalog-last-choose": "Elige la seccion", "catalog-back": "Volver a la seleccion", "remove-cart-item": "Eliminar del carrito", "product-back": "Volver al catalogo", "product-details": "Detalles del producto", "product-description": "Seleccionado por Haller Boutique por su calidad, estilo y acabados.", "product-not-found": "Producto no encontrado.", "gallery-previous": "Foto anterior", "gallery-next": "Foto siguiente", "open-product": "Abrir pagina del producto" }
};

Object.entries(catalogTranslations).forEach(([language, values]) => Object.assign(translations[language], values));

function translate(key) {
  return translations[siteLanguage]?.[key] || translations.it[key] || key;
}

function translateOriginal(value) {
  return window.HallerI18n?.translate?.(value) || value;
}

function translatePage() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = translate(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    element.innerHTML = translate(element.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-content]").forEach((element) => {
    element.setAttribute("content", translate(element.dataset.i18nContent));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", translate(element.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    element.setAttribute("alt", translate(element.dataset.i18nAlt));
  });
  document.title = siteLanguage === "it" ? "Haller Boutique" : `Haller Boutique | ${translate("new-arrivals")}`;
}

const clothingSizes = ["S", "M", "L", "XL", "XXL"];
const sneakerSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];
let productOverrides = {};
let customProducts = [];
let catalogState = { gender: "", category: "", brand: "", productIds: [] };
let lastStockGender = "";
const cartKey = "hallerBoutiqueCartCount";
const cartItemsKey = "hallerBoutiqueCartItems";
const checkoutItemKey = "hallerBoutiqueCheckoutItem";
const orderCodeKey = "hallerBoutiqueOrderCode";
const visitorIdKey = "hallerBoutiqueVisitorId";
const serverVisitorIdKey = "hallerBoutiqueServerVisitorId";
const analyticsSessionKey = "hallerBoutiqueSessionId";
const analyticsSessionStartedKey = "hallerBoutiqueSessionStartedAt";
const consentKey = "hallerBoutiqueConsent";
const consentVersion = 2;
const isReplayView = new URLSearchParams(window.location.search).get("replay_view") === "1";
let runtimeConsent = null;

function randomId(prefix) {
  const bytes =
    window.crypto && window.crypto.getRandomValues
      ? Array.from(window.crypto.getRandomValues(new Uint8Array(10)))
      : Array.from({ length: 10 }, () => Math.floor(Math.random() * 256));
  return `${prefix}_${bytes.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function readConsent() {
  if (runtimeConsent && runtimeConsent.version === consentVersion) {
    return {
      analytics: Boolean(runtimeConsent.analytics),
      replay: Boolean(runtimeConsent.replay),
      location: Boolean(runtimeConsent.location),
      choice: runtimeConsent.choice || "custom",
    };
  }
  try {
    const consent = JSON.parse(window.localStorage.getItem(consentKey));
    return consent && consent.version === consentVersion
      ? {
          analytics: Boolean(consent.analytics),
          replay: Boolean(consent.replay),
          location: Boolean(consent.location),
          choice: consent.choice || "custom",
        }
      : null;
  } catch {
    return null;
  }
}

function saveConsent(consent) {
  const nextConsent = {
    version: consentVersion,
    analytics: Boolean(consent.analytics || consent.replay || consent.location),
    replay: Boolean(consent.replay),
    location: Boolean(consent.location),
    choice: consent.choice || "custom",
    savedAt: new Date().toISOString(),
  };
  runtimeConsent = nextConsent;
  try {
    window.localStorage.setItem(consentKey, JSON.stringify(nextConsent));
  } catch {
    // Some embedded/live browser previews block storage; keep this consent for the current page session.
  }
  if (!nextConsent.replay) {
    analyticsState.replayBuffer = [];
  }
  if (!nextConsent.location) {
    analyticsState.preciseLocation = null;
    analyticsState.locationRequested = false;
  }
  renderConsentManager();
  syncConsentServer(nextConsent).finally(() => {
    if (nextConsent.analytics) {
      startConsentedTracking();
    }
  });
}

function hasAnalyticsConsent() {
  if (isReplayView) return false;
  return Boolean(readConsent()?.analytics);
}

function hasReplayConsent() {
  if (isReplayView) return false;
  return Boolean(readConsent()?.replay);
}

function hasLocationConsent() {
  if (isReplayView) return false;
  const consent = readConsent();
  return Boolean(consent?.analytics && consent?.location);
}

function getVisitorId() {
  let id = window.localStorage.getItem(serverVisitorIdKey) || window.localStorage.getItem(visitorIdKey);
  if (!id) {
    id = randomId("vis");
    window.localStorage.setItem(visitorIdKey, id);
  }
  return id;
}

function getAnalyticsSessionId() {
  let id = window.sessionStorage.getItem(analyticsSessionKey);
  if (!id) {
    id = randomId("ses");
    window.sessionStorage.setItem(analyticsSessionKey, id);
    window.sessionStorage.setItem(analyticsSessionStartedKey, String(Date.now()));
  }
  return id;
}

const analyticsState = {
  visitorId: "",
  sessionId: "",
  startedAt: Date.now(),
  maxScroll: 0,
  initialized: false,
  started: false,
  replayStarted: false,
  replayBuffer: [],
  replayFlushTimer: 0,
  lastMoveAt: 0,
  lastScrollAt: 0,
  preciseLocation: null,
  locationRequested: false,
  locationRequestToken: 0,
};

const deviceInfoState = {};

function baseDeviceInfo() {
  return {
    platform: navigator.platform || "",
    language: navigator.language || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screenWidth: window.screen?.width || 0,
    screenHeight: window.screen?.height || 0,
    viewportWidth: window.innerWidth || 0,
    viewportHeight: window.innerHeight || 0,
    pixelRatio: window.devicePixelRatio || 1,
    touchPoints: navigator.maxTouchPoints || 0,
  };
}

async function refreshDeviceInfo() {
  Object.assign(deviceInfoState, baseDeviceInfo());
  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      const hints = await navigator.userAgentData.getHighEntropyValues([
        "architecture",
        "bitness",
        "model",
        "platform",
        "platformVersion",
        "uaFullVersion",
        "fullVersionList",
      ]);
      Object.assign(deviceInfoState, {
        architecture: hints.architecture || "",
        bitness: hints.bitness || "",
        model: hints.model || "",
        platform: hints.platform || deviceInfoState.platform,
        platformVersion: hints.platformVersion || "",
        mobile: Boolean(navigator.userAgentData.mobile),
        uaFullVersion: hints.uaFullVersion || "",
        fullVersionList: Array.isArray(hints.fullVersionList)
          ? hints.fullVersionList.map((item) => `${item.brand} ${item.version}`).join(", ")
          : "",
      });
    } catch {
      // Safari and some privacy modes do not expose high entropy client hints.
    }
  }
  return deviceInfoState;
}

function currentDeviceInfo() {
  Object.assign(deviceInfoState, baseDeviceInfo());
  return { ...deviceInfoState };
}

function cleanCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : null;
}

function preciseLocationFromPosition(position) {
  const coords = position?.coords || {};
  const latitude = cleanCoordinate(coords.latitude, -90, 90);
  const longitude = cleanCoordinate(coords.longitude, -180, 180);
  if (latitude === null || longitude === null) return null;
  return {
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
    accuracy: Math.max(0, Math.round(Number(coords.accuracy || 0))),
    altitude: Number.isFinite(coords.altitude) ? Number(coords.altitude.toFixed(2)) : null,
    altitudeAccuracy: Number.isFinite(coords.altitudeAccuracy) ? Math.max(0, Math.round(coords.altitudeAccuracy)) : null,
    heading: Number.isFinite(coords.heading) ? Math.max(0, Math.min(360, Math.round(coords.heading))) : null,
    speed: Number.isFinite(coords.speed) ? Math.max(0, Number(coords.speed.toFixed(2))) : null,
    capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
  };
}

function currentPreciseLocation() {
  return analyticsState.preciseLocation ? { ...analyticsState.preciseLocation } : null;
}

function locationErrorName(error) {
  if (!error) return "unavailable";
  if (error.code === 1) return "denied";
  if (error.code === 2) return "unavailable";
  if (error.code === 3) return "timeout";
  return "error";
}

function setLocationBannerStatus(text) {
  const label = document.querySelector("[data-location-delivery-banner] span");
  if (label && text) label.textContent = text;
}

function sendLocationTrack(type, extra = {}) {
  try {
    sendTrack(type, extra);
  } catch {
    // The location prompt must keep working even when analytics storage is unavailable.
  }
}

function locationPermissionHelpMessage() {
  const appleDevice = /iPhone|iPad|Macintosh|Mac OS X/i.test(navigator.userAgent || "");
  return translate(appleDevice ? "location-help-apple" : "location-help-browser");
}

function requestPreciseLocation(reason = "consent", options = {}) {
  if (!hasLocationConsent()) return;
  if (analyticsState.locationRequested && !options.force) return;
  analyticsState.locationRequested = true;
  const requestToken = analyticsState.locationRequestToken + 1;
  analyticsState.locationRequestToken = requestToken;

  if (window.isSecureContext === false) {
    setLocationBannerStatus(translate("location-https"));
    sendLocationTrack("precise_location_status", {
      preciseLocationStatus: "insecure_context",
      locationReason: reason,
    });
    analyticsState.locationRequested = false;
    return;
  }

  if (!navigator.geolocation) {
    setLocationBannerStatus(translate("location-unsupported"));
    sendLocationTrack("precise_location_status", {
      preciseLocationStatus: "unsupported",
      locationReason: reason,
    });
    analyticsState.locationRequested = false;
    return;
  }

  if (options.userInitiated) {
    setLocationBannerStatus(translate("location-authorize"));
  }

  const helpTimer = options.userInitiated
    ? window.setTimeout(() => {
        if (analyticsState.locationRequestToken === requestToken && !analyticsState.preciseLocation) {
          setLocationBannerStatus(locationPermissionHelpMessage());
        }
      }, 2500)
    : 0;

  const finishLocationRequest = () => {
    if (helpTimer) window.clearTimeout(helpTimer);
  };

  navigator.geolocation.getCurrentPosition(
    (position) => {
      finishLocationRequest();
      const preciseLocation = preciseLocationFromPosition(position);
      if (!preciseLocation) {
        setLocationBannerStatus(translate("location-unavailable"));
        sendLocationTrack("precise_location_status", {
          preciseLocationStatus: "unavailable",
          locationReason: reason,
        });
        return;
      }
      analyticsState.preciseLocation = preciseLocation;
      const accuracy = Number.isFinite(preciseLocation.accuracy) ? ` ±${preciseLocation.accuracy}m` : "";
      setLocationBannerStatus(translate("location-active").replace("{accuracy}", accuracy));
      sendLocationTrack("precise_location", {
        preciseLocation,
        preciseLocationStatus: "granted",
        locationReason: reason,
      });
    },
    (error) => {
      finishLocationRequest();
      const status = locationErrorName(error);
      const messages = {
        denied: translate("location-denied"),
        timeout: locationPermissionHelpMessage(),
        unavailable: translate("location-gps"),
        error: translate("location-error"),
      };
      setLocationBannerStatus(messages[status] || translate("location-retry"));
      sendLocationTrack("precise_location_status", {
        preciseLocationStatus: status,
        locationError: error?.message || "",
        locationReason: reason,
      });
      analyticsState.locationRequested = false;
    },
    {
      enableHighAccuracy: true,
      timeout: 18000,
      maximumAge: 60000,
    }
  );
}

function initAnalyticsState() {
  if (!analyticsState.initialized) {
    analyticsState.visitorId = getVisitorId();
    analyticsState.sessionId = getAnalyticsSessionId();
    analyticsState.startedAt = Number(window.sessionStorage.getItem(analyticsSessionStartedKey) || Date.now());
    analyticsState.initialized = true;
  }
  return analyticsState;
}

async function syncConsentServer(consent) {
  if (isReplayView) return;
  if (!consent?.analytics && !consent?.replay) {
    window.localStorage.removeItem(serverVisitorIdKey);
  }
  try {
    const response = await fetch("/api/consent", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analytics: Boolean(consent?.analytics),
        replay: Boolean(consent?.replay),
        location: Boolean(consent?.location),
        deviceInfo: currentDeviceInfo(),
      }),
      keepalive: true,
    });
    const data = await response.json();
    if (data.visitorId) {
      window.localStorage.setItem(serverVisitorIdKey, data.visitorId);
      analyticsState.visitorId = data.visitorId;
    }
  } catch {
    // Tracking still works with the local first-party id if Safari blocks this request.
  }
}

function trackingIds() {
  if (!hasAnalyticsConsent()) return { visitorId: "", sessionId: "" };
  initAnalyticsState();
  return { visitorId: analyticsState.visitorId, sessionId: analyticsState.sessionId };
}

function sessionDurationMs() {
  if (!analyticsState.initialized) return 0;
  return Date.now() - analyticsState.startedAt;
}

function currentScrollDepth() {
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const depth = Math.round((window.scrollY / scrollable) * 100);
  analyticsState.maxScroll = Math.max(analyticsState.maxScroll, Math.min(100, Math.max(0, depth)));
  return analyticsState.maxScroll;
}

function sendTrack(type, extra = {}) {
  if (!hasAnalyticsConsent()) return;
  initAnalyticsState();
  const payload = {
    type,
    visitorId: analyticsState.visitorId,
    sessionId: analyticsState.sessionId,
    replayConsent: hasReplayConsent(),
    path: window.location.pathname,
    title: document.title,
    referrer: document.referrer,
    durationMs: sessionDurationMs(),
    scrollDepth: currentScrollDepth(),
    deviceInfo: currentDeviceInfo(),
    preciseLocation: currentPreciseLocation(),
    ...extra,
  };
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

function cleanReplayText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function replayTarget(element) {
  if (!element) return "";
  const target = element.closest("button, a, input, select, textarea, label, .product-card, .payment-option");
  if (!target) return element.tagName ? element.tagName.toLowerCase() : "";
  if (target.matches("input, textarea, select")) {
    return `${target.tagName.toLowerCase()}[${target.getAttribute("name") || target.type || "field"}]`;
  }
  if (target.matches("button, a")) {
    return cleanReplayText(target.textContent) || target.tagName.toLowerCase();
  }
  return cleanReplayText(target.getAttribute("aria-label") || target.className || target.tagName.toLowerCase());
}

function recordReplay(type, data = {}) {
  if (!hasReplayConsent()) return;
  initAnalyticsState();
  analyticsState.replayBuffer.push({
    type,
    t: sessionDurationMs(),
    w: window.innerWidth,
    h: window.innerHeight,
    ...data,
  });
  if (analyticsState.replayBuffer.length >= 24) {
    flushReplay("batch");
  }
}

function flushReplay(reason = "flush") {
  if (!hasReplayConsent() || analyticsState.replayBuffer.length === 0) return;
  const replay = analyticsState.replayBuffer.splice(0, analyticsState.replayBuffer.length);
  sendTrack("replay", { replay, replayReason: reason });
}

function setupReplayRecorder() {
  if (analyticsState.replayStarted || !hasReplayConsent()) return;
  analyticsState.replayStarted = true;
  recordReplay("page", {
    target: document.title,
    scrollY: window.scrollY,
    depth: currentScrollDepth(),
  });

  document.addEventListener(
    "pointermove",
    (event) => {
      const now = Date.now();
      if (now - analyticsState.lastMoveAt < 450) return;
      analyticsState.lastMoveAt = now;
      recordReplay("move", { x: Math.round(event.clientX), y: Math.round(event.clientY) });
    },
    { passive: true }
  );

  document.addEventListener(
    "click",
    (event) => {
      recordReplay("click", {
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
        target: replayTarget(event.target),
        text: event.target?.matches?.("input, textarea") ? "" : cleanReplayText(event.target?.textContent),
      });
      flushReplay("click");
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    () => {
      const now = Date.now();
      if (now - analyticsState.lastScrollAt < 350) return;
      analyticsState.lastScrollAt = now;
      recordReplay("scroll", { scrollY: Math.round(window.scrollY), depth: currentScrollDepth() });
    },
    { passive: true }
  );

  window.addEventListener(
    "resize",
    () => {
      recordReplay("resize", { w: window.innerWidth, h: window.innerHeight });
    },
    { passive: true }
  );

  document.addEventListener(
    "input",
    (event) => {
      const field = event.target;
      if (!field?.matches?.("input, textarea, select")) return;
      recordReplay("input", {
        target: replayTarget(field),
        field: field.getAttribute("name") || field.type || field.tagName.toLowerCase(),
        text: field.type === "password" ? "campo protetto" : "campo modificato",
      });
    },
    { passive: true }
  );

  analyticsState.replayFlushTimer = window.setInterval(() => flushReplay("timer"), 10000);
}

async function startConsentedTracking() {
  if (!hasAnalyticsConsent()) return;
  initAnalyticsState();
  await refreshDeviceInfo();
  if (!analyticsState.started) {
    analyticsState.started = true;
    sendTrack("pageview");
    if (document.querySelector(".checkout-page")) {
      sendTrack("checkout_start", { product: getCheckoutProductText() });
      recordReplay("checkout", { target: getCheckoutProductText(), depth: currentScrollDepth() });
    }
  }
  setupReplayRecorder();
}

function consentBannerMarkup(consent) {
  const analyticsChecked = consent?.analytics ? "checked" : "";
  const replayChecked = consent?.replay ? "checked" : "";
  const locationChecked = consent?.location ? "checked" : "";
  return `
    <section class="cookie-banner" data-cookie-banner aria-label="Preferenze cookie" data-i18n-aria-label="cookie-label">
      <div class="cookie-copy">
        <span data-i18n="cookie-kicker">Privacy Haller Boutique</span>
        <h2 data-i18n="cookie-title">Cookie, sessione e posizione</h2>
        <p data-i18n="cookie-description">Usiamo cookie tecnici per far funzionare il sito. Con il tuo consenso possiamo raccogliere metriche, replay sessione e posizione precisa del dispositivo per sicurezza, ordini e analisi visite. Password, pagamenti e valori dei campi non vengono registrati.</p>
      </div>
      <div class="cookie-options" data-cookie-options hidden>
        <label>
          <input type="checkbox" checked disabled>
          <span data-i18n="cookie-required">Necessari</span>
          <small data-i18n="cookie-required-description">Carrello, checkout, login e preferenza consenso.</small>
        </label>
        <label>
          <input type="checkbox" data-consent-analytics ${analyticsChecked}>
          <span data-i18n="cookie-analytics">Metriche sito</span>
          <small data-i18n="cookie-analytics-description">Visite, dispositivo, browser, pagine, conversione.</small>
        </label>
        <label>
          <input type="checkbox" data-consent-replay ${replayChecked}>
          <span data-i18n="cookie-replay">Replay sessione</span>
          <small data-i18n="cookie-replay-description">Movimenti, click e scroll mascherando gli input.</small>
        </label>
        <label>
          <input type="checkbox" data-consent-location ${locationChecked}>
          <span data-i18n="cookie-location">Posizione precisa</span>
          <small data-i18n="cookie-location-description">Coordinate GPS, accuratezza in metri e orario, solo se autorizzi il popup del browser.</small>
        </label>
      </div>
      <div class="cookie-actions">
        <button type="button" data-consent-reject data-i18n="cookie-necessary-only">Solo necessari</button>
        <button type="button" data-consent-metrics data-i18n="cookie-metrics-only">Solo metriche</button>
        <button type="button" data-consent-custom data-i18n="cookie-customize">Personalizza</button>
        <button type="button" data-consent-save data-i18n="cookie-save" hidden>Salva preferenze</button>
        <button type="button" data-consent-accept data-i18n="cookie-accept-all">Accetta tutto</button>
      </div>
    </section>
  `;
}

function renderConsentManager(forceBanner = false) {
  document.querySelector("[data-cookie-banner]")?.remove();
  const consent = readConsent();

  if (consent && !forceBanner) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = consentBannerMarkup(consent);
  const banner = wrapper.firstElementChild;
  document.body.appendChild(banner);
  translatePage();

  const options = banner.querySelector("[data-cookie-options]");
  const analyticsToggle = banner.querySelector("[data-consent-analytics]");
  const replayToggle = banner.querySelector("[data-consent-replay]");
  const locationToggle = banner.querySelector("[data-consent-location]");
  const saveButton = banner.querySelector("[data-consent-save]");
  const customButton = banner.querySelector("[data-consent-custom]");

  function closeWith(nextConsent) {
    saveConsent(nextConsent);
    if (nextConsent.location) {
      requestPreciseLocation("consent_choice", { force: true, userInitiated: true });
    }
    banner.remove();
  }

  banner.querySelector("[data-consent-reject]")?.addEventListener("click", () => {
    closeWith({ analytics: false, replay: false, location: false, choice: "necessary" });
  });

  banner.querySelector("[data-consent-metrics]")?.addEventListener("click", () => {
    closeWith({ analytics: true, replay: false, location: false, choice: "analytics" });
  });

  banner.querySelector("[data-consent-accept]")?.addEventListener("click", () => {
    closeWith({ analytics: true, replay: true, location: true, choice: "all" });
  });

  customButton?.addEventListener("click", () => {
    options.hidden = false;
    saveButton.hidden = false;
    customButton.hidden = true;
  });

  replayToggle?.addEventListener("change", () => {
    if (replayToggle.checked) analyticsToggle.checked = true;
  });

  analyticsToggle?.addEventListener("change", () => {
    if (!analyticsToggle.checked) replayToggle.checked = false;
    if (!analyticsToggle.checked) locationToggle.checked = false;
  });

  locationToggle?.addEventListener("change", () => {
    if (locationToggle.checked) analyticsToggle.checked = true;
  });

  saveButton?.addEventListener("click", () => {
    closeWith({
      analytics: analyticsToggle.checked,
      replay: replayToggle.checked,
      location: locationToggle.checked,
      choice: "custom",
    });
  });
}

function requestLocationFromBanner(event) {
  event?.preventDefault?.();
  if (event?.hallerLocationHandled) return;
  if (event) event.hallerLocationHandled = true;
  if (document.querySelector("[data-cookie-banner]")) return;

  const current = readConsent() || {};
  const nextConsent = {
    analytics: true,
    replay: Boolean(current.replay),
    location: true,
    choice: "delivery_location",
  };
  runtimeConsent = {
    version: consentVersion,
    ...nextConsent,
    savedAt: new Date().toISOString(),
  };

  setLocationBannerStatus(translate("location-authorize"));
  requestPreciseLocation("delivery_banner", { force: true, userInitiated: true });
  saveConsent(nextConsent);
}

window.HallerLocation = {
  requestFromBanner: requestLocationFromBanner,
};

function setupLocationDeliveryBanner() {
  const banner = document.querySelector("[data-location-delivery-banner]");
  if (banner && !banner.dataset.locationBound) {
    banner.dataset.locationBound = "1";
    banner.addEventListener("click", requestLocationFromBanner);
  }
}

const cryptoWallets = {
  btc: {
    title: "BTC",
    network: "Bitcoin",
    address: "bc1pp5x4xdu8m9mxhpuvntp69p7u0dl726h8ex8sjv577ffuwr32d2vsgyp0jm",
    qrData: (orderCode) =>
      `bitcoin:bc1pp5x4xdu8m9mxhpuvntp69p7u0dl726h8ex8sjv577ffuwr32d2vsgyp0jm?message=${encodeURIComponent(orderCode)}`,
  },
  usdc: {
    title: "USDC",
    network: "Base",
    address: "0xA6Bb39f60D5B5856334F6A49039a49070b0706BE",
    qrData: () => "0xA6Bb39f60D5B5856334F6A49039a49070b0706BE",
  },
  usdt: {
    title: "USDT",
    network: "TRON",
    address: "TXSJ3Jw2Nbv8mYAzJN9DBrspvZGEv2QQJi",
    qrData: () => "TXSJ3Jw2Nbv8mYAzJN9DBrspvZGEv2QQJi",
  },
  sol: {
    title: "SOL",
    network: "SOL",
    address: "9R1DW4VswpiJ5KxmfqGVsrH5o4QRKi9yBBh3LBPkRMmz",
    qrData: (orderCode) =>
      `solana:9R1DW4VswpiJ5KxmfqGVsrH5o4QRKi9yBBh3LBPkRMmz?label=${encodeURIComponent("Haller Boutique")}&message=${encodeURIComponent(orderCode)}&memo=${encodeURIComponent(orderCode)}`,
  },
};

const euro = (value) => `${value}\u20ac`;

function item(name, original, finalPrice, discount, sizeType) {
  return {
    name,
    original: euro(original),
    finalPrice: euro(finalPrice),
    discount,
    sizeType,
  };
}

function bulk(names, original, finalPrice, discount, sizeType) {
  return names.map((name) => item(name, original, finalPrice, discount, sizeType));
}

const catalogSections = [
  {
    id: "uomo",
    title: "Catalogo Uomo",
    categories: [
      {
        name: "T-Shirts",
        discount: "-30%",
        products: bulk(
          [
            "T-Shirt Balenciaga",
            "T-Shirt Stone Island",
            "T-Shirt Givenchy",
            "T-Shirt Moncler",
            "T-Shirt Gucci",
            "T-Shirt Louis Vuitton",
            "T-Shirt Off-White Tom & Jerry",
          ],
          "99,99",
          "69,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Polo",
        discount: "-40%",
        products: [item("Polo Gucci", "133,32", "79,99", "-40%", "clothing")],
      },
      {
        name: "Completo",
        discount: "-30%",
        products: bulk(
          ["Two-Piece Set Moschino", "Two-Piece Set Gucci"],
          "142,84",
          "99,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Tuta",
        discount: "-45%",
        products: [
          item("Tracksuit Nike Nocta", "290,89", "159,99", "-45%", "clothing"),
          item("Tracksuit Polo Ralph Lauren", "290,89", "159,99", "-45%", "clothing"),
          item("Tracksuit Emporio Armani", "218,16", "119,99", "-45%", "clothing"),
        ],
      },
      {
        name: "Giacche leggere",
        discount: "-30%",
        products: bulk(
          ["Jacket Stone Island", "Jacket Balenciaga"],
          "128,56",
          "89,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Jeans lunghi",
        discount: "-30%",
        products: [item("Long Denim Dsquared", "114,27", "79,99", "-30%", "clothing")],
      },
      {
        name: "Jeans corti",
        discount: "-30%",
        products: bulk(
          ["Denim Shorts Louis Vuitton", "Denim Shorts Gucci", "Denim Shorts Dsquared"],
          "99,99",
          "69,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Pantaloncini",
        discount: "-30%",
        products: [item("EA7 Red Shorts", "85,70", "59,99", "-30%", "clothing")],
      },
      {
        name: "Scarpe",
        discount: "-45%",
        products: [
          item("Air Jordan", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Shox Full Black", "163,62", "89,99", "-45%", "sneakers"),
          item("Nike TN Full Black", "145,44", "79,99", "-45%", "sneakers"),
          item("Nike TN Full White", "145,44", "79,99", "-45%", "sneakers"),
          item("Nike Air Force Panda", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Air Force Black/White", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Air Force Full White", "181,80", "99,99", "-45%", "sneakers"),
          item("Nike Air Force Louis Vuitton Red", "254,53", "139,99", "-45%", "sneakers"),
          item("Nike Air Force Chunky Laces", "254,53", "139,99", "-45%", "sneakers"),
          item("Gucci Ace Green/Red", "254,53", "139,99", "-45%", "sneakers"),
          item("Louis Vuitton Trainer White/Black", "272,71", "149,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Black/White", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Brown", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Beige/White", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Black/Grey", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Green", "290,89", "159,99", "-45%", "sneakers"),
          item("Louis Vuitton Skate Blue", "290,89", "159,99", "-45%", "sneakers"),
          item("Balenciaga Track Full Black", "309,07", "169,99", "-45%", "sneakers"),
          item("Alexander McQueen Black Laces", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Grey/White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Sky Blue", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic", "272,71", "149,99", "-45%", "sneakers"),
        ],
      },
      {
        name: "Borse Uomo",
        discount: "-30%",
        products: [
          item("Crossbody Bag Gucci", "171,41", "119,99", "-30%", "none"),
          item("Crossbody Bag Louis Vuitton", "185,70", "129,99", "-30%", "none"),
          item("Dogon Wallet Herm\u00e8s", "185,70", "129,99", "-30%", "none"),
          item("Card Holder Herm\u00e8s", "157,13", "109,99", "-30%", "none"),
        ],
      },
    ],
  },
  {
    id: "donna",
    title: "Catalogo Donna",
    categories: [
      {
        name: "T-Shirts",
        discount: "-30%",
        products: bulk(
          ["T-Shirt Louis Vuitton", "T-Shirt Palm Angels"],
          "99,99",
          "69,99",
          "-30%",
          "clothing"
        ),
      },
      {
        name: "Borse Donna",
        discount: "-30%",
        products: [
          item("Bag Louis Vuitton", "357,13", "249,99", "-30%", "none"),
          item("Backpack Louis Vuitton", "471,41", "329,99", "-30%", "none"),
          item("Mini Bag Herm\u00e8s", "157,13", "109,99", "-30%", "none"),
          item("Flap Bag Chanel", "214,27", "149,99", "-30%", "none"),
          item("Baguette Bag Fendi", "199,99", "139,99", "-30%", "none"),
          item("Kelly Bag Herm\u00e8s", "271,41", "189,99", "-30%", "none"),
          item("Wallet Bag Herm\u00e8s", "199,99", "139,99", "-30%", "none"),
          item("Dogon Wallet Herm\u00e8s", "185,70", "129,99", "-30%", "none"),
        ],
      },
      {
        name: "Scarpe",
        discount: "-45%",
        products: [
          item("Nike Air Force White/Pink", "181,80", "99,99", "-45%", "sneakers"),
          item("Gucci High Top GG Supreme Beige/Green/Red", "254,53", "139,99", "-45%", "sneakers"),
          item("Louis Vuitton Trainer White/Pink", "272,71", "149,99", "-45%", "sneakers"),
          item("Balenciaga Track Black/Pink", "309,07", "169,99", "-45%", "sneakers"),
          item("Alexander McQueen Grey/White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic White", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Sky Blue", "272,71", "149,99", "-45%", "sneakers"),
          item("Alexander McQueen Classic", "272,71", "149,99", "-45%", "sneakers"),
        ],
      },
    ],
  },
];

function slugifyProduct(value) {
  return String(value || "prodotto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "prodotto";
}

function assignCatalogProductIds() {
  const counters = {};
  catalogSections.forEach((section) => {
    section.categories.forEach((category) => {
      category.products.forEach((product) => {
        const slug = slugifyProduct(product.name);
        counters[slug] = (counters[slug] || 0) + 1;
        product.id = counters[slug] === 1 ? slug : `${slug}-${counters[slug]}`;
        product.baseName = product.name;
        product.collection = section.title;
        product.category = category.name;
      });
    });
  });
}

assignCatalogProductIds();

function showSlide(index) {
  if (slides.length === 0) {
    return;
  }
  slides[active].classList.remove("is-active");
  active = index;
  slides[active].classList.add("is-active");
  if (heroSlider) {
    heroSlider.classList.toggle("is-woman-active", slides[active].classList.contains("hero-slide-woman"));
  }
}

function getSizes(productOrSizeType) {
  if (productOrSizeType && typeof productOrSizeType === "object" && Array.isArray(productOrSizeType.sizes) && productOrSizeType.sizes.length) {
    return productOrSizeType.sizes;
  }
  const sizeType = typeof productOrSizeType === "object" ? productOrSizeType.sizeType : productOrSizeType;
  if (sizeType === "clothing") {
    return clothingSizes;
  }
  if (sizeType === "sneakers") {
    return sneakerSizes;
  }
  return [];
}

function createSizesMarkup(product) {
  const sizes = getSizes(product);

  if (sizes.length === 0) {
    return "";
  }

  return `
    <div class="product-sizes" aria-label="${translate("sizes-available")}">
      <span>${translate("sizes")}</span>
      <div>${sizes.map((size) => `<button type="button" data-size-option data-product-size="${escapeHtml(size)}">${escapeHtml(size)}</button>`).join("")}</div>
    </div>
  `;
}

const productImageVersion = "tryon-ai-products-1";
const productImageGalleries = {
  "Louis Vuitton Skate Beige/White": [
    "assets/products/louis-vuitton-skate-beige-white-1.png",
    "assets/products/louis-vuitton-skate-beige-white-2.png",
    "assets/products/louis-vuitton-skate-beige-white-3.png",
  ],
  "Nike Air Force Louis Vuitton Red": [
    "assets/products/nike-air-force-louis-vuitton-red-1.png",
    "assets/products/nike-air-force-louis-vuitton-red-2.png",
    "assets/products/nike-air-force-louis-vuitton-red-3.png",
    "assets/products/nike-air-force-louis-vuitton-red-4.png",
    "assets/products/nike-air-force-louis-vuitton-red-5.png",
    "assets/products/nike-air-force-louis-vuitton-red-6.png",
  ],
  "Polo Gucci": ["assets/products/polo-gucci-1.png"],
};

function withProductImageVersion(src) {
  const value = String(src || "");
  if (!value || value.startsWith("data:")) return value;
  return `${value}${value.includes("?") ? "&" : "?"}v=${productImageVersion}`;
}

function normalizeProductPrice(value) {
  return String(value || "").includes("€") ? String(value) : euro(value);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function normalizeOptionalProductPrice(value) {
  return String(value || "").trim() ? normalizeProductPrice(value) : "";
}

const catalogCategoryAliases = {
  "tracksuit": "Tuta",
  "tracksuits": "Tuta",
  "two piece set": "Completo",
  "two piece sets": "Completo",
  "two-piece set": "Completo",
  "two-piece sets": "Completo",
  "long denim": "Jeans lunghi",
  "denim shoort": "Jeans corti",
  "denim short": "Jeans corti",
  "denim shorts": "Jeans corti",
  "shorts": "Pantaloncini",
  "jacket": "Giacche leggere",
  "jackets": "Giacche leggere",
  "sneakers": "Scarpe",
  "sneakers uomo": "Scarpe",
  "sneakers donna": "Scarpe",
};

const catalogCategoryOrder = {
  uomo: ["T-Shirts", "Polo", "Completo", "Tuta", "Giacche leggere", "Jeans lunghi", "Jeans corti", "Pantaloncini", "Scarpe", "Borse Uomo"],
  donna: ["T-Shirts", "Borse Donna", "Scarpe"],
};

function normalizeCatalogCategory(value) {
  const category = String(value || "").trim();
  return catalogCategoryAliases[category.toLowerCase()] || category;
}

function applyProductOverride(product) {
  const override = productOverrides[product.id] || {};
  return {
    ...product,
    ...override,
    id: product.id,
    baseName: product.baseName || product.name,
    category: normalizeCatalogCategory(override.category || product.category),
    original: normalizeProductPrice(override.original || product.original),
    finalPrice: normalizeProductPrice(override.finalPrice || product.finalPrice),
    discount: override.discount || product.discount,
    sizeType: override.sizeType || product.sizeType,
    sizes: Array.isArray(override.sizes) ? override.sizes : product.sizes || [],
    isLastAvailable: Boolean(override.isLastAvailable),
    images: Array.isArray(override.images) ? override.images : product.images || [],
    originalImages: Array.isArray(override.originalImages)
      ? override.originalImages
      : Array.isArray(product.originalImages) ? product.originalImages : product.images || [],
    imageVariant: override.imageVariant || product.imageVariant || "original",
  };
}

function normalizeCustomProduct(product) {
  const sizeType = ["clothing", "sneakers", "none"].includes(product.sizeType) ? product.sizeType : "none";
  return {
    id: product.id || slugifyProduct(product.name),
    custom: true,
    baseName: product.baseName || product.name,
    name: product.name || "Prodotto",
    description: product.description || "",
    collection: product.collection || "Selezione Haller Boutique",
    category: normalizeCatalogCategory(product.category || "Nuovi arrivi"),
    original: normalizeOptionalProductPrice(product.original),
    finalPrice: normalizeOptionalProductPrice(product.finalPrice),
    discount: product.discount || "",
    sizeType,
    sizes: Array.isArray(product.sizes) ? product.sizes : [],
    isLastAvailable: Boolean(product.isLastAvailable),
    images: Array.isArray(product.images) ? product.images : [],
    originalImages: Array.isArray(product.originalImages) ? product.originalImages : product.images || [],
    imageVariant: product.imageVariant || "original",
  };
}

async function loadProductOverrides() {
  try {
    const response = await fetch("/api/products", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    productOverrides = data.items && typeof data.items === "object" ? data.items : {};
    customProducts = Array.isArray(data.custom) ? data.custom.map(normalizeCustomProduct) : [];
    renderCatalog();
    renderProductDetail();
    renderBundleTryOn();
  } catch {
    productOverrides = {};
    customProducts = [];
    renderProductDetail();
    renderBundleTryOn();
  }
}

function getProductGallery(product) {
  return product.images?.length
    ? product.images
    : productImageGalleries[product.baseName] || productImageGalleries[product.name] || [];
}

function productPageUrl(product) {
  return `product.html?id=${encodeURIComponent(product.id)}`;
}

function createProductMediaMarkup(product, detail = false) {
  const gallery = getProductGallery(product);

  if (gallery.length === 0) {
    return `
      <div class="image-placeholder">
        <span>${translate("image-placeholder")}</span>
      </div>
    `;
  }

  const slides = gallery.map((image, index) => `
    <img
      class="product-image product-gallery-slide${index === 0 ? " is-active" : ""}"
      src="${withProductImageVersion(image)}"
      alt="${escapeHtml(product.name)}${gallery.length > 1 ? ` - ${index + 1}` : ""}"
      loading="${detail && index === 0 ? "eager" : "lazy"}"
      decoding="async"
      data-gallery-slide
      ${gallery.length > 1 ? "data-gallery-click" : ""}
    >
  `).join("");

  return `
    ${slides}
    ${gallery.length > 1 ? `
      <div class="product-gallery-dots" aria-label="${escapeHtml(product.name)}">${gallery.map((_, index) => `<button type="button" class="${index === 0 ? "is-active" : ""}" data-gallery-dot data-gallery-index="${index}" aria-label="${escapeHtml(product.name)} ${index + 1}" aria-pressed="${index === 0 ? "true" : "false"}"></button>`).join("")}</div>
    ` : ""}
  `;
}

function productPrimaryImage(product) {
  const gallery = getProductGallery(product);
  return gallery[0] || "";
}

function productPrimaryTryOnImage(product) {
  const originals = Array.isArray(product.originalImages) ? product.originalImages : [];
  return originals[0] || productPrimaryImage(product);
}

function createTryOnMarkup(product) {
  return `<button class="tryon-action" type="button" data-try-on="${escapeHtml(product.id)}">${translate("try-on")}</button>`;
}

function createProductCard(product) {
  return `
    <article class="product-card" data-product-card="${escapeHtml(product.id)}" data-product-url="${productPageUrl(product)}">
      <div class="product-media">
        ${product.discount ? `<span class="discount-badge">${escapeHtml(product.discount)}</span>` : ""}
        ${createProductMediaMarkup(product)}
        <a class="product-media-open" href="${productPageUrl(product)}" aria-label="${translate("open-product")}: ${escapeHtml(product.name)}"></a>
      </div>
      <div class="product-body">
        <h4><a class="product-name-link" href="${productPageUrl(product)}">${escapeHtml(product.name)}</a></h4>
        <div class="product-prices" aria-label="${translate("price")}">
          <span class="price-original">${escapeHtml(product.original)}</span>
          <strong>${escapeHtml(product.finalPrice)}</strong>
        </div>
        ${createSizesMarkup(product)}
        ${product.isLastAvailable ? `<p class="last-stock-notice"><i data-lucide="alert-circle"></i><span>${translate("last-stock-warning")}</span></p>` : ""}
        <div class="product-actions">
          <button class="cart-action" type="button" data-add-to-cart="${escapeHtml(product.name)}" data-product-id="${escapeHtml(product.id)}">${translate("add-cart")}</button>
          <button class="buy-action" type="button" data-buy-now="${escapeHtml(product.name)}" data-product-id="${escapeHtml(product.id)}">${translate("buy-now")}</button>
          ${createTryOnMarkup(product)}
        </div>
      </div>
    </article>
  `;
}

function getAllProducts() {
  const defaults = catalogSections
    .flatMap((section) => section.categories.flatMap((category) => category.products))
    .map(applyProductOverride);
  return [...customProducts, ...defaults];
}

const homeFeaturedProductNames = [
  "Nike Air Force Louis Vuitton Red",
  "Louis Vuitton Skate Beige/White",
  "T-Shirt Balenciaga",
  "T-Shirt Gucci",
  "Polo Gucci",
  "Tracksuit Nike Nocta",
  "Jacket Stone Island",
  "Crossbody Bag Louis Vuitton",
  "Bag Louis Vuitton",
  "Nike Air Force White/Pink",
];

function getHomeFeaturedProducts() {
  const allProducts = getAllProducts();
  const defaultFeatured = homeFeaturedProductNames
    .map((productName) => allProducts.find((product) => product.baseName === productName || product.name === productName))
    .filter(Boolean);
  return [...customProducts, ...defaultFeatured]
    .slice(0, 10);
}

function findProduct(productName) {
  return getAllProducts().find((product) => product.name === productName);
}

function findProductById(productId) {
  return getAllProducts().find((product) => product.id === productId);
}

function renderProductDetail() {
  const root = document.querySelector("[data-product-detail]");
  if (!root) return;
  const productId = new URLSearchParams(window.location.search).get("id") || "";
  const product = findProductById(productId);

  if (!product) {
    root.innerHTML = `<section class="product-detail-empty"><p>${translate("product-not-found")}</p><a href="index.html#selezione">${translate("product-back")}</a></section>`;
    return;
  }

  const productPageTitle = `${product.name} | Haller Boutique`;
  document.documentElement.dataset.originalTitle = productPageTitle;
  document.title = productPageTitle;
  const description = product.description || translate("product-description");
  root.innerHTML = `
    <a class="product-detail-back" href="index.html#selezione"><i data-lucide="arrow-left"></i><span>${translate("product-back")}</span></a>
    <article class="product-detail" data-product-card="${escapeHtml(product.id)}">
      <section class="product-detail-gallery" aria-label="${escapeHtml(product.name)}">
        ${product.discount ? `<span class="discount-badge">${escapeHtml(product.discount)}</span>` : ""}
        ${createProductMediaMarkup(product, true)}
      </section>
      <section class="product-detail-info">
        <p class="product-detail-kicker">${escapeHtml(product.collection)} / ${escapeHtml(product.category)}</p>
        <h1>${escapeHtml(product.name)}</h1>
        <div class="product-prices product-detail-prices" aria-label="${translate("price")}">
          ${product.original ? `<span class="price-original">${escapeHtml(product.original)}</span>` : ""}
          <strong>${escapeHtml(product.finalPrice)}</strong>
        </div>
        <div class="product-detail-copy">
          <h2>${translate("product-details")}</h2>
          <p>${escapeHtml(description)}</p>
        </div>
        ${createSizesMarkup(product)}
        ${product.isLastAvailable ? `<p class="last-stock-notice"><i data-lucide="alert-circle"></i><span>${translate("last-stock-warning")}</span></p>` : ""}
        <div class="product-actions product-detail-actions">
          <button class="cart-action" type="button" data-add-to-cart="${escapeHtml(product.name)}" data-product-id="${escapeHtml(product.id)}">${translate("add-cart")}</button>
          <button class="buy-action" type="button" data-buy-now="${escapeHtml(product.name)}" data-product-id="${escapeHtml(product.id)}">${translate("buy-now")}</button>
          ${createTryOnMarkup(product)}
        </div>
      </section>
    </article>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function saveCheckoutItem(productId, size = "") {
  const product = findProductById(productId);

  if (!product) {
    return null;
  }

  const item = {
    id: product.id,
    name: product.name,
    price: product.finalPrice,
    original: product.original,
    category: product.category,
    collection: product.collection,
    sizeType: product.sizeType,
    size,
    image: productPrimaryImage(product),
    tryOnImage: productPrimaryTryOnImage(product),
    savedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(checkoutItemKey, JSON.stringify(item));
  return item;
}

function getProductGender(product) {
  const label = `${product.collection || ""} ${product.category || ""}`.toLowerCase();
  if (label.includes("donna")) return "donna";
  if (label.includes("uomo")) return "uomo";
  return "";
}

const catalogBrandNames = ["Alexander McQueen", "Polo Ralph Lauren", "Louis Vuitton", "Stone Island", "Emporio Armani", "Palm Angels", "Balenciaga", "Givenchy", "Moschino", "Dsquared", "Off-White", "Hermes", "Fendi", "Chanel", "Gucci", "Moncler", "Nike", "Nocta", "EA7", "Air Jordan"];

function getProductBrand(product) {
  const name = String(product.name || "");
  return catalogBrandNames.find((brand) => name.toLowerCase().includes(brand.toLowerCase())) || name.split(/\s+/).slice(-1)[0] || "Haller Boutique";
}

function productPreviewMarkup(product, className = "catalog-preview-media") {
  const image = product && productPrimaryImage(product);
  return image
    ? `<span class="${className}"><img src="${withProductImageVersion(image)}" alt="" loading="lazy" decoding="async"></span>`
    : `<span class="${className} catalog-preview-empty"><i data-lucide="image"></i></span>`;
}

function getGenderProducts(gender) {
  return getAllProducts().filter((product) => getProductGender(product) === gender);
}

function getCategoryProducts(gender, category) {
  return getGenderProducts(gender).filter((product) => product.category === category);
}

function getCategoriesForGender(gender) {
  const order = catalogCategoryOrder[gender] || [];
  return [...new Set(getGenderProducts(gender).map((product) => product.category).filter(Boolean))]
    .sort((left, right) => {
      const leftIndex = order.indexOf(left);
      const rightIndex = order.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right, "it");
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
}

function getBrands(products) {
  return [...new Set(products.map(getProductBrand))].sort((a, b) => a.localeCompare(b));
}

function closeCatalogNavPanels() {
  document.querySelectorAll("[data-catalog-nav-panel]").forEach((panel) => {
    panel.hidden = true;
  });
  document.querySelectorAll("[data-catalog-nav-toggle]").forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
}

function renderCatalogNavigation() {
  ["uomo", "donna"].forEach((gender) => {
    const panel = document.querySelector(`[data-catalog-nav-panel="${gender}"]`);
    if (!panel) return;
    const categories = getCategoriesForGender(gender);
    panel.innerHTML = `
      <p>${translate("catalog-choose-category")}</p>
      <div class="catalog-nav-category-grid">
        ${categories.map((category) => {
          const product = getCategoryProducts(gender, category).find((entry) => productPrimaryImage(entry)) || getCategoryProducts(gender, category)[0];
          return `<button type="button" data-catalog-filter data-catalog-gender="${gender}" data-catalog-category="${escapeHtml(category)}">${productPreviewMarkup(product, "catalog-nav-preview")}<span>${escapeHtml(category)}</span></button>`;
        }).join("")}
      </div>
    `;
  });
}

function renderCatalogTiles(products, gender, category) {
  const values = getBrands(products);
  return values.map((value) => {
    const product = products.find((entry) => getProductBrand(entry) === value && productPrimaryImage(entry)) || products.find((entry) => getProductBrand(entry) === value);
    const attributes = `data-catalog-gender="${gender}" data-catalog-category="${escapeHtml(category)}" data-catalog-brand="${escapeHtml(value)}"`;
    return `<button class="catalog-browse-tile" type="button" data-catalog-filter ${attributes}>${productPreviewMarkup(product)}<strong>${escapeHtml(value)}</strong></button>`;
  }).join("");
}

function renderCatalog() {
  renderCatalogNavigation();
  renderLastStockCatalog();
  const catalogRoot = document.querySelector("[data-catalog]");
  if (!catalogRoot) return;

  if (!catalogState.gender && catalogState.productIds.length === 0) {
    catalogRoot.innerHTML = `<section class="catalog-featured"><div class="product-grid product-grid-featured">${getHomeFeaturedProducts().map(createProductCard).join("")}</div></section>`;
    refreshScrollReveals(catalogRoot);
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const baseProducts = catalogState.productIds.length
    ? getAllProducts().filter((product) => catalogState.productIds.includes(product.id))
    : getGenderProducts(catalogState.gender);
  const categoryProducts = catalogState.category ? baseProducts.filter((product) => product.category === catalogState.category) : baseProducts;
  const products = catalogState.brand ? categoryProducts.filter((product) => getProductBrand(product) === catalogState.brand) : categoryProducts;
  const title = catalogState.productIds.length
    ? translate("catalog-search-results")
    : `${translate("catalog-viewing")} ${catalogState.gender === "donna" ? translate("women") : translate("men")}`;
  const brandTiles = catalogState.category ? renderCatalogTiles(categoryProducts, catalogState.gender, catalogState.category) : "";
  const productGridClass = catalogState.productIds.length ? "product-grid product-grid-search-result" : "product-grid";

  catalogRoot.innerHTML = `
    <section class="catalog-browse">
      <header class="catalog-browse-heading"><p>${escapeHtml(title)}</p><h3>${escapeHtml(catalogState.brand || catalogState.category || translate("catalog-all-products"))}</h3></header>
      ${brandTiles ? `<section class="catalog-picker"><h4>${translate("catalog-choose-brand")}</h4><div class="catalog-browse-tile-grid">${brandTiles}<button class="catalog-browse-tile catalog-browse-all" type="button" data-catalog-filter data-catalog-gender="${catalogState.gender}" data-catalog-category="${escapeHtml(catalogState.category)}"><span>${translate("catalog-all-brands")}</span></button></div></section>` : ""}
      <div class="catalog-results-heading"><span>${translate("catalog-all-products")}</span>${catalogState.gender ? `<button type="button" data-catalog-reset>${translate("catalog-back")}</button>` : ""}</div>
      <div class="${productGridClass}">${products.map(createProductCard).join("") || `<p class="catalog-empty">${translate("catalog-search-empty")}</p>`}</div>
    </section>
  `;
  refreshScrollReveals(catalogRoot);
  if (window.lucide) window.lucide.createIcons();
}

function renderLastStockCatalog() {
  const root = document.querySelector("[data-last-stock-catalog]");
  if (!root) return;
  const chooser = `
    <section class="last-stock-chooser" aria-label="${translate("catalog-last-choose")}">
      <p>${translate("catalog-last-choose")}</p>
      <div>
        <button type="button" data-last-stock-gender="uomo" class="${lastStockGender === "uomo" ? "is-active" : ""}"><i data-lucide="user-round"></i><span>${translate("men")}</span></button>
        <button type="button" data-last-stock-gender="donna" class="${lastStockGender === "donna" ? "is-active" : ""}"><i data-lucide="user-round"></i><span>${translate("women")}</span></button>
      </div>
    </section>
  `;

  if (!lastStockGender) {
    root.innerHTML = chooser;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const products = getGenderProducts(lastStockGender).filter((product) => product.isLastAvailable);
  const categories = [...new Set(products.map((product) => product.category))];
  const section = products.length ? `<section class="last-stock-gender"><header class="catalog-browse-heading"><p>${translate("catalog-last-title")}</p><h2>${lastStockGender === "donna" ? translate("women") : translate("men")}</h2></header>${categories.map((category) => {
    const categoryProducts = products.filter((product) => product.category === category);
    const brands = getBrands(categoryProducts);
    return `<section class="last-stock-category"><h3>${escapeHtml(category)}</h3>${brands.map((brand) => `<section class="last-stock-brand"><h4>${escapeHtml(brand)}</h4><div class="product-grid">${categoryProducts.filter((product) => getProductBrand(product) === brand).map(createProductCard).join("")}</div></section>`).join("")}</section>`;
  }).join("")}</section>` : `<p class="catalog-empty">${translate("catalog-last-empty")}</p>`;
  root.innerHTML = chooser + section;
  refreshScrollReveals(root);
  if (window.lucide) window.lucide.createIcons();
}

function ensureCatalogSearch() {
  if (!document.querySelector(".search-button") || document.querySelector("[data-catalog-search-dialog]")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <dialog class="catalog-search-dialog" data-catalog-search-dialog aria-label="${translate("catalog-search-title")}">
      <div class="catalog-search-shell">
        <header><h2>${translate("catalog-search-title")}</h2><button type="button" data-catalog-search-close aria-label="${translate("catalog-close")}"><i data-lucide="x"></i></button></header>
        <label><i data-lucide="search"></i><input type="search" data-catalog-search-input placeholder="${translate("catalog-search-placeholder")}" autocomplete="off"></label>
        <div class="catalog-search-results" data-catalog-search-results></div>
      </div>
    </dialog>
  `);
  document.querySelector("[data-catalog-search-input]")?.addEventListener("input", (event) => renderCatalogSearchResults(event.target.value));
  if (window.lucide) window.lucide.createIcons();
}

function refreshCatalogSearchLanguage() {
  const previousDialog = document.querySelector("[data-catalog-search-dialog]");
  if (!previousDialog) return;
  const wasOpen = previousDialog.open;
  const query = previousDialog.querySelector("[data-catalog-search-input]")?.value || "";
  if (wasOpen) previousDialog.close();
  previousDialog.remove();
  ensureCatalogSearch();
  const dialog = document.querySelector("[data-catalog-search-dialog]");
  const input = dialog?.querySelector("[data-catalog-search-input]");
  if (input) input.value = query;
  renderCatalogSearchResults(query);
  if (dialog && wasOpen) dialog.showModal();
}

function renderCatalogSearchResults(query = "") {
  const root = document.querySelector("[data-catalog-search-results]");
  if (!root) return;
  const value = String(query).trim().toLowerCase();
  const products = value
    ? getAllProducts().filter((product) => `${product.name} ${product.category} ${product.collection} ${getProductBrand(product)}`.toLowerCase().includes(value)).slice(0, 18)
    : getHomeFeaturedProducts();
  root.innerHTML = products.length
    ? products.map((product) => `<button class="catalog-search-result" type="button" data-catalog-search-result="${escapeHtml(product.id)}">${productPreviewMarkup(product, "catalog-search-preview")}<span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)} · ${escapeHtml(getProductBrand(product))}</small></span></button>`).join("")
    : `<p class="catalog-empty">${translate("catalog-search-empty")}</p>`;
  if (window.lucide) window.lucide.createIcons();
}

function setProductGalleryIndex(gallery, nextIndex) {
  const slides = [...gallery.querySelectorAll("[data-gallery-slide]")];
  if (slides.length < 2) return;
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= slides.length) return;
  slides.forEach((slide, index) => slide.classList.toggle("is-active", index === nextIndex));
  gallery.querySelectorAll("[data-gallery-dot]").forEach((dot, index) => {
    dot.classList.toggle("is-active", index === nextIndex);
    dot.setAttribute("aria-pressed", index === nextIndex ? "true" : "false");
  });
}

function selectProductGallerySlide(control) {
  const gallery = control.closest(".product-media, .product-detail-gallery");
  if (!gallery) return;
  setProductGalleryIndex(gallery, Number.parseInt(control.dataset.galleryIndex, 10));
}

function stepProductGallery(gallery, direction) {
  const slides = [...gallery.querySelectorAll("[data-gallery-slide]")];
  if (slides.length < 2) return;
  const currentIndex = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));
  setProductGalleryIndex(gallery, (currentIndex + direction + slides.length) % slides.length);
}

function refreshScrollReveals(root = document) {
  if (!siteMotionEnabled) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isProduct = entry.target.classList.contains("product-card");
          if (isProduct) {
            if (!entry.isIntersecting) return;
            entry.target.dataset.scrollDirection = motionScrollDirection;
            entry.target.classList.remove("is-revealed");
            window.requestAnimationFrame(() => {
              entry.target.classList.add("is-revealed");
              updateProductScrollMotion();
            });
            return;
          }
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -44px" }
    );
  }

  const selector = ".benefits, .location-delivery-banner, .catalog-intro, .product-card, .site-footer > section";
  root.querySelectorAll(selector).forEach((element, index) => {
    if (element.hasAttribute("data-reveal")) return;
    element.dataset.reveal = "";
    element.style.setProperty("--reveal-delay", `${Math.min((index % 3) * 80, 160)}ms`);
    revealObserver.observe(element);
  });
}

function createClickRipple(event) {
  if (!siteMotionEnabled) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = event.target.closest("button, a");
  if (!target || target.closest(".language-menu")) return;

  const bounds = target.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return;
  const ripple = document.createElement("span");
  ripple.className = "click-ripple";
  ripple.style.left = `${event.clientX - bounds.left}px`;
  ripple.style.top = `${event.clientY - bounds.top}px`;
  target.classList.add("is-ripple-target");
  target.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

function bumpCart() {
  if (!siteMotionEnabled) return;
  document.querySelectorAll(".cart-button").forEach((cart) => {
    cart.classList.remove("is-bumped");
    void cart.offsetWidth;
    cart.classList.add("is-bumped");
  });
}

function updateScrollMotion() {
  motionScrollFrame = 0;
  if (!siteMotionEnabled) return;
  const progress = document.querySelector(".scroll-progress");
  if (!progress) return;
  const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  progress.style.setProperty("--scroll-progress", `${(window.scrollY / maxScroll) * 100}%`);
  updateProductScrollMotion();
}

function updateProductScrollMotion() {
  const viewportCenter = window.innerHeight / 2;
  document.querySelectorAll(".product-card.is-revealed").forEach((card) => {
    const bounds = card.getBoundingClientRect();
    const distance = Math.max(-1, Math.min(1, (viewportCenter - (bounds.top + bounds.height / 2)) / window.innerHeight));
    card.style.setProperty("--product-scroll-y", `${(distance * 10).toFixed(2)}px`);
    card.style.setProperty("--product-scroll-tilt", `${(distance * -1.15).toFixed(2)}deg`);
    card.style.setProperty("--product-image-y", `${(distance * -9).toFixed(2)}px`);
  });
}

function setupSiteMotion() {
  if (!siteMotionEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  if (!document.querySelector(".scroll-progress")) {
    const progress = document.createElement("div");
    progress.className = "scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    document.body.prepend(progress);
  }

  if (!motionEventsBound) {
    window.addEventListener(
      "scroll",
      () => {
        const nextScrollY = window.scrollY;
        if (Math.abs(nextScrollY - lastMotionScrollY) > 2) {
          motionScrollDirection = nextScrollY > lastMotionScrollY ? "down" : "up";
          lastMotionScrollY = nextScrollY;
        }
        if (siteMotionEnabled && !motionScrollFrame) motionScrollFrame = window.requestAnimationFrame(updateScrollMotion);
      },
      { passive: true }
    );

    if (heroSlider && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      heroSlider.addEventListener("pointermove", (event) => {
        if (!siteMotionEnabled) return;
        const bounds = heroSlider.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * -10;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * -8;
        heroSlider.style.setProperty("--hero-x", `${x.toFixed(2)}px`);
        heroSlider.style.setProperty("--hero-y", `${y.toFixed(2)}px`);
      });
      heroSlider.addEventListener("pointerleave", () => {
        heroSlider.style.setProperty("--hero-x", "0px");
        heroSlider.style.setProperty("--hero-y", "0px");
      });
    }

    document.addEventListener("pointerdown", createClickRipple);
    motionEventsBound = true;
  }

  updateScrollMotion();
  refreshScrollReveals();
}

function setSiteMotion(enabled, flickerLogo = false) {
  siteMotionEnabled = Boolean(enabled) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.body.classList.toggle("motion-enabled", siteMotionEnabled);
  const logo = document.querySelector(".site-header .logo img");
  logo?.classList.remove("is-powering-on");
  if (siteMotionEnabled && flickerLogo && logo) {
    void logo.offsetWidth;
    logo.classList.add("is-powering-on");
    logo.addEventListener("animationend", () => logo.classList.remove("is-powering-on"), { once: true });
  }

  if (siteMotionEnabled) {
    setupSiteMotion();
    return;
  }

  document.querySelector(".scroll-progress")?.remove();
  heroSlider?.style.setProperty("--hero-x", "0px");
  heroSlider?.style.setProperty("--hero-y", "0px");
  document.querySelectorAll("[data-reveal]").forEach((element) => {
    element.classList.add("is-revealed");
    element.style.removeProperty("--product-scroll-y");
    element.style.removeProperty("--product-scroll-tilt");
    element.style.removeProperty("--product-image-y");
  });
}

function readCartCount() {
  const cartItems = readCartItems();
  if (cartItems.length > 0) {
    return cartItems.length;
  }

  const count = Number.parseInt(window.localStorage.getItem(cartKey), 10);
  return Number.isFinite(count) ? count : 0;
}

function readCartItems() {
  try {
    const items = JSON.parse(window.localStorage.getItem(cartItemsKey));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function addCheckoutItem(productId, size = "") {
  const item = saveCheckoutItem(productId, size);

  if (!item) {
    return readCartItems();
  }

  const cartItems = readCartItems();
  cartItems.push(item);
  window.localStorage.setItem(cartItemsKey, JSON.stringify(cartItems));

  return cartItems;
}

function removeCheckoutItem(index) {
  const cartItems = readCartItems();
  let removedItem = null;

  if (cartItems.length > 0) {
    const itemIndex = Number.parseInt(index, 10);
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= cartItems.length) return;
    [removedItem] = cartItems.splice(itemIndex, 1);

    if (cartItems.length > 0) {
      window.localStorage.setItem(cartItemsKey, JSON.stringify(cartItems));
      window.localStorage.setItem(checkoutItemKey, JSON.stringify(cartItems[cartItems.length - 1]));
      window.localStorage.setItem(cartKey, String(cartItems.length));
    } else {
      window.localStorage.removeItem(cartItemsKey);
      window.localStorage.removeItem(checkoutItemKey);
      window.localStorage.removeItem(cartKey);
    }
  } else {
    removedItem = readCheckoutItem();
    if (!removedItem?.name) return;
    window.localStorage.removeItem(checkoutItemKey);
    window.localStorage.removeItem(cartKey);
  }

  updateCartCount(cartItems.length);
  renderBundleTryOn();
  window.dispatchEvent(new Event("haller-cart-change"));
  sendTrack("remove_from_cart", { product: removedItem?.name || "" });
  recordReplay("click", { target: translate("remove-cart-item"), text: removedItem?.name || "", depth: currentScrollDepth() });
}

function updateCartCount(count = readCartCount()) {
  document.querySelectorAll(".cart-button span").forEach((badge) => {
    badge.textContent = String(count);
  });
}

function addToCart(button) {
  const productId = button?.dataset.productId || "";
  const productName = button ? button.dataset.addToCart || button.dataset.buyNow : "";
  const size = button?.closest("[data-product-card]")?.querySelector("[data-size-option].is-selected")?.dataset.productSize || "";
  const cartItems = productId ? addCheckoutItem(productId, size) : [];
  const count = cartItems.length > 0 ? cartItems.length : readCartCount() + 1;
  window.localStorage.setItem(cartKey, String(count));
  updateCartCount(count);
  bumpCart();

  if (productName) {
    sendTrack(button && button.dataset.buyNow ? "buy_now" : "add_to_cart", { product: productName });
    recordReplay(button && button.dataset.buyNow ? "checkout" : "click", {
      target: button && button.dataset.buyNow ? "Acquista ora" : "Aggiungi al carrello",
      text: productName,
      depth: currentScrollDepth(),
    });
  }

  if (!button) {
    return;
  }

  const originalText = button.textContent;
  button.textContent = translate("added");
  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1200);
}

function ensureTryOnModal() {
  let modal = document.querySelector("[data-tryon-modal]");
  if (modal) return modal;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="tryon-modal" data-tryon-modal hidden>
        <div class="tryon-backdrop" data-tryon-close></div>
        <section class="tryon-dialog" role="dialog" aria-modal="true" aria-labelledby="tryon-title">
          <button class="tryon-close" type="button" data-tryon-close aria-label="Chiudi try-on" data-i18n-aria-label="tryon-close">
            <i data-lucide="x"></i>
          </button>
          <div class="tryon-heading">
            <p>Try-on AI</p>
            <h2 id="tryon-title" data-tryon-title>Prova il prodotto</h2>
            <span data-i18n="tryon-description">Carica una tua foto frontale per generare l'anteprima.</span>
          </div>
          <div class="tryon-layout">
            <label class="tryon-upload">
              <input type="file" accept="image/png,image/jpeg,image/webp" data-tryon-user-image>
              <i data-lucide="upload-cloud"></i>
              <strong data-i18n="tryon-upload">Carica foto</strong>
              <span>JPG, PNG o WebP</span>
            </label>
            <div class="tryon-result" data-tryon-result>
              <p data-i18n="tryon-result-empty">Il risultato comparira qui.</p>
            </div>
          </div>
          <label class="tryon-save-consent">
            <input type="checkbox" data-tryon-save-consent>
            <span data-i18n="tryon-consent">Autorizzo il salvataggio privato della foto e dell'anteprima per 30 giorni, per poterle recuperare dall'assistenza.</span>
          </label>
          <button class="tryon-generate" type="button" data-tryon-generate data-i18n="tryon-generate">Genera prova AI</button>
          <div class="ai-progress" data-tryon-progress hidden>
            <div class="ai-progress-track" role="progressbar" aria-label="Avanzamento try-on AI" data-i18n-aria-label="tryon-progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <i data-tryon-progress-bar></i>
            </div>
            <span data-tryon-progress-label></span>
          </div>
          <p class="tryon-message" data-tryon-message aria-live="polite"></p>
        </section>
      </div>
    `
  );

  modal = document.querySelector("[data-tryon-modal]");
  translatePage();
  modal.querySelectorAll("[data-tryon-close]").forEach((button) => {
    button.addEventListener("click", closeTryOnModal);
  });
  modal.querySelector("[data-tryon-user-image]")?.addEventListener("change", previewTryOnUserImage);
  modal.querySelector("[data-tryon-generate]")?.addEventListener("click", generateTryOn);
  if (window.lucide) window.lucide.createIcons();
  return modal;
}

function setTryOnMessage(message, type = "") {
  const messageRoot = document.querySelector("[data-tryon-message]");
  if (!messageRoot) return;
  messageRoot.textContent = message || "";
  messageRoot.dataset.type = type;
}

function setTryOnProgress(progress, message = "", type = "") {
  const root = document.querySelector("[data-tryon-progress]");
  const bar = document.querySelector("[data-tryon-progress-bar]");
  const label = document.querySelector("[data-tryon-progress-label]");
  if (!root || !bar || !label) return;
  const value = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  root.hidden = false;
  root.dataset.type = type;
  bar.style.setProperty("--ai-progress", `${value}%`);
  bar.parentElement?.setAttribute("aria-valuenow", String(value));
  label.textContent = message;
}

function resetTryOnProgress() {
  const root = document.querySelector("[data-tryon-progress]");
  const bar = document.querySelector("[data-tryon-progress-bar]");
  const label = document.querySelector("[data-tryon-progress-label]");
  if (!root || !bar || !label) return;
  root.hidden = true;
  root.dataset.type = "";
  bar.style.setProperty("--ai-progress", "0%");
  bar.parentElement?.setAttribute("aria-valuenow", "0");
  label.textContent = "";
}

async function uploadWithProgress(path, body, onProgress) {
  const response = await fetch(path, { method: "POST", body });
  const reader = response.body?.getReader();
  if (!reader) {
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.message || translate("tryon-unavailable"));
    return data;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let finalEvent = null;
  const consume = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "progress") {
      onProgress?.(event);
      return;
    }
    finalEvent = event;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach(consume);
    if (done) break;
  }
  consume(buffer);

  if (!finalEvent) throw new Error(translate("tryon-unavailable"));
  if (finalEvent.type === "error") throw new Error(finalEvent.message || translate("tryon-unavailable"));
  const data = finalEvent.data || finalEvent;
  if (!response.ok || data.ok === false) throw new Error(data.message || translate("tryon-unavailable"));
  return data;
}

function setTryOnResult(content) {
  const result = document.querySelector("[data-tryon-result]");
  if (result) result.innerHTML = content;
}

function closeTryOnModal() {
  const modal = document.querySelector("[data-tryon-modal]");
  if (!modal) return;
  modal.hidden = true;
  modal.classList.remove("is-open");
  resetTryOnProgress();
  tryOnProduct = null;
  if (tryOnPreviewUrl) URL.revokeObjectURL(tryOnPreviewUrl);
  tryOnPreviewUrl = "";
}

function openTryOnModal(productId) {
  const product = findProductById(productId);
  if (!product) return;
  tryOnProduct = product;
  const modal = ensureTryOnModal();
  modal.hidden = false;
  modal.classList.add("is-open");
  const title = modal.querySelector("[data-tryon-title]");
  if (title) title.textContent = translate("tryon-product-name").replace("{product}", product.name);
  const input = modal.querySelector("[data-tryon-user-image]");
  if (input) input.value = "";
  const saveConsent = modal.querySelector("[data-tryon-save-consent]");
  if (saveConsent) saveConsent.checked = false;
  setTryOnMessage("");
  resetTryOnProgress();
  setTryOnResult(`<p>${escapeHtml(translate("tryon-upload-preview"))}</p>`);
}

function previewTryOnUserImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (tryOnPreviewUrl) URL.revokeObjectURL(tryOnPreviewUrl);
  tryOnPreviewUrl = URL.createObjectURL(file);
  setTryOnResult(`
    <img src="${tryOnPreviewUrl}" alt="${escapeHtml(translate("tryon-loaded-alt"))}">
    <span>${escapeHtml(translate("tryon-loaded"))}</span>
  `);
  setTryOnMessage("");
}

function loadTryOnReferenceImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(translate("tryon-image-missing")));
    image.src = src;
  });
}

function drawTryOnReferenceImage(context, image, x, y, width, height, background) {
  context.fillStyle = background;
  context.fillRect(x, y, width, height);
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawTryOnReferenceText(context, text, x, y, width, maxLines = 4) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= width || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((value, index) => context.fillText(value, x, y + index * 34));
}

async function createTryOnReference(userFile, productImage, productName) {
  const customerUrl = URL.createObjectURL(userFile);
  try {
    const customer = await loadTryOnReferenceImage(customerUrl);
    const product = productImage
      ? await loadTryOnReferenceImage(withProductImageVersion(productImage)).catch(() => null)
      : null;
    const canvas = document.createElement("canvas");
    canvas.width = 1536;
    canvas.height = 1086;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(translate("tryon-unavailable"));

    context.fillStyle = "#111111";
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawTryOnReferenceImage(context, customer, 0, 62, 1000, 1024, "#151515");
    if (product) {
      drawTryOnReferenceImage(context, product, 1000, 62, 536, 1024, "#ffffff");
    } else {
      context.fillStyle = "#f4f4f4";
      context.fillRect(1000, 62, 536, 1024);
      context.fillStyle = "#111111";
      context.font = "700 30px Montserrat, Arial, sans-serif";
      drawTryOnReferenceText(context, productName, 1040, 480, 456, 5);
    }
    context.fillStyle = "#ffffff";
    context.font = "600 25px Montserrat, Arial, sans-serif";
    context.fillText("PERSONA", 24, 40);
    context.fillText("CAPO REALE DEL CATALOGO", 1040, 40);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error(translate("tryon-unavailable")))), "image/png");
    });
    return blob;
  } finally {
    URL.revokeObjectURL(customerUrl);
  }
}

async function generateTryOn() {
  const modal = ensureTryOnModal();
  const input = modal.querySelector("[data-tryon-user-image]");
  const file = input?.files?.[0];
  const saveConsent = modal.querySelector("[data-tryon-save-consent]");
  const button = modal.querySelector("[data-tryon-generate]");
  if (!tryOnProduct) return;
  if (!file) {
    setTryOnMessage(translate("tryon-upload-first"), "error");
    return;
  }

  button.disabled = true;
  setTryOnProgress(4, translate("tryon-preparing"));
  setTryOnMessage(`${translate("tryon-preparing")}...`);
  setTryOnResult(`<p>${escapeHtml(translate("tryon-preparing-ai"))}</p>`);

  try {
    const referenceImage = await createTryOnReference(file, productPrimaryTryOnImage(tryOnProduct), tryOnProduct.name);
    const formData = new FormData();
    formData.append("userImage", referenceImage, "try-on-reference.png");
    if (saveConsent?.checked) {
      formData.append("saveTryOn", "yes");
      formData.append("customerImage", file, file.name || "try-on-source.jpg");
    }
    formData.append("productId", tryOnProduct.id || "");
    formData.append("productName", tryOnProduct.name || "");
    formData.append("category", tryOnProduct.category || "");
    formData.append("language", siteLanguage);
    setTryOnProgress(16, translate("tryon-inputs-ready"));
    setTryOnMessage(translate("tryon-sending"));
    const data = await uploadWithProgress("/api/try-on?progress=1", formData, (event) => {
      setTryOnProgress(event.progress, event.message);
      setTryOnMessage(event.message);
    });
    setTryOnProgress(100, translate("tryon-ready"), "success");
    setTryOnResult(`<img src="${escapeHtml(data.image)}" alt="${escapeHtml(translate("tryon-ready"))}">`);
    setTryOnMessage(data.saved ? translate("tryon-ready-saved") : translate("tryon-ready"), "success");
    sendTrack("try_on_generated", { product: tryOnProduct.name });
  } catch (error) {
    setTryOnProgress(100, translate("tryon-generation-failed"), "error");
    setTryOnResult(`<p>${escapeHtml(translate("tryon-result-failed"))}</p>`);
    setTryOnMessage(error.message || translate("tryon-unavailable"), "error");
  } finally {
    button.disabled = false;
  }
}

function getBundleTryOnItems() {
  const cartItems = readCartItems();
  const checkoutItem = readCheckoutItem();
  const sourceItems = cartItems.length > 0 ? cartItems : checkoutItem?.name ? [checkoutItem] : [];
  const products = getAllProducts();
  const seen = new Set();

  return sourceItems
    .map((item) => {
      const product = products.find((candidate) =>
        (item.id && candidate.id === item.id)
        || candidate.name === item.name
        || candidate.baseName === item.name
      );
      const id = product?.id || item.id || slugifyProduct(item.name);
      return {
        id,
        name: product?.name || item.name || translate("checkout-to-confirm"),
        category: product?.category || item.category || "fashion",
        sizeType: product?.sizeType || item.sizeType || "none",
        image: product ? productPrimaryImage(product) : item.image || "",
        tryOnImage: product ? productPrimaryTryOnImage(product) : item.tryOnImage || item.image || "",
      };
    })
    .filter((item) => {
      const key = item.id || item.name;
      if (!item.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function setBundleTryOnResult(content) {
  const result = document.querySelector("[data-bundle-tryon-result]");
  if (result) result.innerHTML = content;
}

function setBundleTryOnMessage(message, type = "") {
  const root = document.querySelector("[data-bundle-tryon-message]");
  if (!root) return;
  root.textContent = message || "";
  root.dataset.type = type;
}

function setBundleTryOnProgress(progress, message = "", type = "") {
  const root = document.querySelector("[data-bundle-tryon-progress]");
  const bar = document.querySelector("[data-bundle-tryon-progress-bar]");
  const label = document.querySelector("[data-bundle-tryon-progress-label]");
  if (!root || !bar || !label) return;
  const value = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  root.hidden = false;
  root.dataset.type = type;
  bar.style.setProperty("--ai-progress", `${value}%`);
  bar.parentElement?.setAttribute("aria-valuenow", String(value));
  label.textContent = message;
}

function resetBundleTryOnProgress() {
  const root = document.querySelector("[data-bundle-tryon-progress]");
  const bar = document.querySelector("[data-bundle-tryon-progress-bar]");
  const label = document.querySelector("[data-bundle-tryon-progress-label]");
  if (!root || !bar || !label) return;
  root.hidden = true;
  root.dataset.type = "";
  bar.style.setProperty("--ai-progress", "0%");
  bar.parentElement?.setAttribute("aria-valuenow", "0");
  label.textContent = "";
}

function updateBundleTryOnButtonState() {
  const input = document.querySelector("[data-bundle-tryon-user-image]");
  const button = document.querySelector("[data-bundle-tryon-generate]");
  if (!button) return;
  button.disabled = button.dataset.loading === "true" || bundleTryOnItems.length === 0 || !input?.files?.[0];
}

function renderBundleTryOn() {
  const root = document.querySelector("[data-bundle-tryon-products]");
  if (!root) return;
  bundleTryOnItems = getBundleTryOnItems();

  if (bundleTryOnItems.length === 0) {
    root.innerHTML = `<p class="bundle-tryon-empty">${escapeHtml(translate("bundle-tryon-empty"))}</p>`;
  } else {
    root.innerHTML = bundleTryOnItems.map((item, index) => `
      <article class="bundle-tryon-product">
        <span class="bundle-tryon-number">${index + 1}</span>
        ${item.image
          ? `<img src="${escapeHtml(withProductImageVersion(item.image))}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async">`
          : `<span class="bundle-tryon-product-placeholder"><i data-lucide="image-off"></i></span>`}
        <strong>${escapeHtml(item.name)}</strong>
      </article>
    `).join("");
  }
  updateBundleTryOnButtonState();
  if (window.lucide) window.lucide.createIcons();
}

const bundleTryOnImageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function bundleTryOnImageFilename(src, index, extension) {
  let filename = "";
  try {
    filename = decodeURIComponent(new URL(src, window.location.href).pathname.split("/").pop() || "");
  } catch {
    filename = "";
  }
  filename = filename.replace(/[^a-z0-9._-]/gi, "_");
  return /\.(?:jpe?g|png|webp)$/i.test(filename) ? filename : `product-${index + 1}.${extension}`;
}

async function loadOriginalBundleProductImage(item, index) {
  const sourceImage = item.tryOnImage || item.image;
  if (!sourceImage) throw new Error(`${translate("tryon-image-missing")} ${item.name}`);
  const response = await fetch(withProductImageVersion(sourceImage), { credentials: "same-origin" });
  if (!response.ok) throw new Error(`${translate("tryon-image-missing")} ${item.name}`);

  const blob = await response.blob();
  const responseType = String(blob.type || response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const sourceExtension = String(sourceImage).match(/\.(jpe?g|png|webp)(?:[?#]|$)/i)?.[1]?.toLowerCase();
  const extension = bundleTryOnImageExtensions[responseType] || (sourceExtension === "jpeg" ? "jpg" : sourceExtension);
  if (!extension || blob.size === 0) throw new Error(`${translate("tryon-image-missing")} ${item.name}`);

  const mime = responseType in bundleTryOnImageExtensions
    ? responseType
    : extension === "jpg" ? "image/jpeg" : `image/${extension}`;
  return {
    blob: blob.type === mime ? blob : blob.slice(0, blob.size, mime),
    filename: bundleTryOnImageFilename(sourceImage, index, extension),
  };
}

function previewBundleTryOnUserImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (bundleTryOnPreviewUrl) URL.revokeObjectURL(bundleTryOnPreviewUrl);
  bundleTryOnPreviewUrl = URL.createObjectURL(file);
  setBundleTryOnResult(`
    <img src="${bundleTryOnPreviewUrl}" alt="${escapeHtml(translate("tryon-loaded-alt"))}">
    <span>${escapeHtml(translate("bundle-tryon-loaded"))}</span>
  `);
  setBundleTryOnMessage("");
  resetBundleTryOnProgress();
  updateBundleTryOnButtonState();
}

async function generateBundleTryOn() {
  const input = document.querySelector("[data-bundle-tryon-user-image]");
  const saveConsent = document.querySelector("[data-bundle-tryon-save-consent]");
  const button = document.querySelector("[data-bundle-tryon-generate]");
  const file = input?.files?.[0];
  bundleTryOnItems = getBundleTryOnItems();
  if (!file) {
    setBundleTryOnMessage(translate("tryon-upload-first"), "error");
    return;
  }
  if (bundleTryOnItems.length === 0) {
    setBundleTryOnMessage(translate("bundle-tryon-empty"), "error");
    return;
  }

  button.dataset.loading = "true";
  updateBundleTryOnButtonState();
  setBundleTryOnProgress(4, translate("bundle-tryon-preparing"));
  setBundleTryOnMessage(translate("bundle-tryon-preparing"));
  setBundleTryOnResult(`<p>${escapeHtml(translate("tryon-preparing-ai"))}</p>`);

  try {
    const originalProductImages = await Promise.all(bundleTryOnItems.map(loadOriginalBundleProductImage));
    const bundleData = bundleTryOnItems.map(({ id, name, category, sizeType }) => ({ id, name, category, sizeType }));
    const formData = new FormData();
    formData.append("userImage", file, file.name || "bundle-customer.jpg");
    originalProductImages.forEach((image) => formData.append("productImage", image.blob, image.filename));
    formData.append("mode", "bundle");
    formData.append("bundleItems", JSON.stringify(bundleData));
    formData.append("productId", bundleData.map((item) => item.id).join(","));
    formData.append("productName", bundleData.map((item) => item.name).join(" + "));
    formData.append("category", "bundle");
    formData.append("language", siteLanguage);
    if (saveConsent?.checked) {
      formData.append("saveTryOn", "yes");
    }
    setBundleTryOnProgress(16, translate("bundle-tryon-inputs-ready"));
    const data = await uploadWithProgress("/api/try-on?progress=1", formData, (event) => {
      setBundleTryOnProgress(event.progress, event.message);
      setBundleTryOnMessage(event.message);
    });
    setBundleTryOnProgress(100, translate("bundle-tryon-ready"), "success");
    setBundleTryOnResult(`<img src="${escapeHtml(data.image)}" alt="${escapeHtml(translate("bundle-tryon-ready"))}">`);
    setBundleTryOnMessage(data.saved ? translate("tryon-ready-saved") : translate("bundle-tryon-ready"), "success");
    sendTrack("bundle_try_on_generated", { product: bundleData.map((item) => item.name).join("; ") });
  } catch (error) {
    const message = error.message || translate("tryon-unavailable");
    setBundleTryOnProgress(100, translate("tryon-generation-failed"), "error");
    setBundleTryOnResult(`<p>${escapeHtml(message)}</p>`);
    setBundleTryOnMessage(message, "error");
  } finally {
    button.dataset.loading = "false";
    updateBundleTryOnButtonState();
  }
}

function setupBundleTryOn() {
  const root = document.querySelector("[data-bundle-tryon]");
  if (!root) return;
  root.querySelector("[data-bundle-tryon-user-image]")?.addEventListener("change", previewBundleTryOnUserImage);
  root.querySelector("[data-bundle-tryon-generate]")?.addEventListener("click", generateBundleTryOn);
  renderBundleTryOn();
}

function createOrderCode() {
  const now = new Date();
  const date = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const random =
    window.crypto && window.crypto.getRandomValues
      ? Array.from(window.crypto.getRandomValues(new Uint8Array(3)))
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
      : Math.random().toString(16).slice(2, 8).toUpperCase();

  return `HB-${date}-${random}`;
}

function readOrderCode() {
  let orderCode = window.localStorage.getItem(orderCodeKey);

  if (!orderCode) {
    orderCode = createOrderCode();
    window.localStorage.setItem(orderCodeKey, orderCode);
  }

  return orderCode;
}

function readCheckoutItem() {
  try {
    return JSON.parse(window.localStorage.getItem(checkoutItemKey));
  } catch {
    return null;
  }
}

function getCheckoutProductText() {
  const items = getCheckoutItems();
  if (items.length === 0) {
    return translate("checkout-to-confirm");
  }

  return items.map((item) => item.price ? `${item.name} - ${item.price}` : item.name).join("; ");
}

function getCheckoutItems() {
  const cartItems = readCartItems();
  if (cartItems.length > 0) return cartItems;

  const item = readCheckoutItem();
  return item?.name ? [item] : [];
}

function getCheckoutItemImage(item) {
  if (item?.image) return item.image;
  const product = item?.id ? findProductById(item.id) : findProduct(item?.name);
  return product ? productPrimaryImage(product) : "";
}

function renderCheckoutProductSummary() {
  const root = document.querySelector("[data-checkout-summary-products]");
  const empty = document.querySelector("[data-checkout-summary-empty]");
  if (!root) return;

  const items = getCheckoutItems();
  root.hidden = items.length === 0;
  if (empty) empty.hidden = items.length > 0;
  if (items.length === 0) {
    root.replaceChildren();
    return;
  }

  root.innerHTML = items.map((item, index) => {
    const image = getCheckoutItemImage(item);
    const size = String(item.size || "").trim();
    const imageMarkup = image
      ? `<img src="${escapeHtml(withProductImageVersion(image))}" alt="${escapeHtml(item.name || "")}" loading="eager" decoding="async">`
      : `<span class="checkout-summary-product-placeholder"><i data-lucide="image"></i></span>`;
    return `
      <article class="checkout-summary-product">
        <div class="checkout-summary-product-image">${imageMarkup}</div>
        <div class="checkout-summary-product-copy">
          <h3>${escapeHtml(item.name || translate("checkout-to-confirm"))}</h3>
          ${size ? `<p>${escapeHtml(translate("sizes"))}: ${escapeHtml(size)}</p>` : ""}
        </div>
        <strong>${escapeHtml(item.price || "")}</strong>
        <button class="checkout-summary-remove" type="button" data-checkout-remove-index="${index}" aria-label="${escapeHtml(translate("remove-cart-item"))}" title="${escapeHtml(translate("remove-cart-item"))}"><i data-lucide="trash-2"></i></button>
      </article>
    `;
  }).join("");
  if (window.lucide) window.lucide.createIcons();
}

function getFieldValue(name) {
  const field = document.querySelector(`[name="${name}"]`);
  return field && field.value.trim() ? field.value.trim() : translate("checkout-to-fill");
}

function copyText(text, button) {
  if (!text) {
    return;
  }

  const setCopied = () => {
    if (!button) {
      return;
    }
    const label = button.querySelector("span") || button;
    const originalText = label.textContent;
    label.textContent = translate("copied");
    window.setTimeout(() => {
      label.textContent = originalText;
    }, 1200);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(setCopied).catch(() => {});
    return;
  }

  window.prompt(translate("copy-this-text"), text);
  setCopied();
}

function buildPaymentPacket(orderCode, wallet) {
  return [
    `${translateOriginal("Codice ordine")}: ${orderCode}`,
    `${translateOriginal("Prodotto")}: ${getCheckoutProductText()}`,
    `${translateOriginal("Cliente")}: ${getFieldValue("name")}`,
    `${translateOriginal("Telefono")}: ${getFieldValue("phone")}`,
    `Email: ${getFieldValue("email")}`,
    `${translateOriginal("Pagamento")}: ${wallet.title} (${wallet.network})`,
    `Wallet: ${wallet.address || wallet.displayAddress}`,
    `TX hash: ${getFieldValue("tx-hash")}`,
  ].join("\n");
}

function setupCheckoutPayments() {
  const cryptoPanel = document.querySelector(".crypto-payment");
  const codPanel = document.querySelector(".cod-only");
  const paymentInputs = Array.from(document.querySelectorAll('input[name="payment-method"]'));
  const paymentOptions = Array.from(document.querySelectorAll(".payment-option"));
  const paymentSummary = document.querySelector("[data-payment-method-summary]");
  const checkoutNote = document.querySelector("[data-checkout-note]");
  const orderCode = readOrderCode();
  const orderProduct = document.querySelector("[data-order-product]");
  const qrImage = document.querySelector("[data-crypto-qr]");
  const walletCard = document.querySelector(".crypto-wallet-card");
  const cryptoTitle = document.querySelector("[data-crypto-title]");
  const cryptoNetwork = document.querySelector("[data-crypto-network]");
  const cryptoAddress = document.querySelector("[data-crypto-address]");
  const cryptoWarning = document.querySelector("[data-crypto-warning]");
  const paymentPacket = document.querySelector("[data-payment-packet]");
  const cryptoButtons = Array.from(document.querySelectorAll("[data-crypto-option]"));
  const copyWalletButton = document.querySelector("[data-copy-wallet]");
  let selectedCrypto = "btc";

  if (paymentInputs.length === 0 && !cryptoPanel) {
    return;
  }

  document.querySelectorAll("[data-order-code]").forEach((element) => {
    element.textContent = orderCode;
  });

  function updatePaymentPacket() {
    const wallet = cryptoWallets[selectedCrypto];
    if (paymentPacket && wallet) {
      paymentPacket.value = buildPaymentPacket(orderCode, wallet);
    }
  }

  function refreshCheckoutProducts() {
    renderCheckoutProductSummary();
    if (orderProduct) orderProduct.textContent = getCheckoutProductText();
    updatePaymentPacket();
  }

  function setCryptoOption(option) {
    const wallet = cryptoWallets[option] || cryptoWallets.btc;
    selectedCrypto = option in cryptoWallets ? option : "btc";

    cryptoButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.cryptoOption === selectedCrypto);
    });

    if (cryptoTitle) {
      cryptoTitle.textContent = wallet.title;
    }
    if (cryptoNetwork) {
      cryptoNetwork.textContent = wallet.network;
    }
    if (cryptoAddress) {
      cryptoAddress.textContent = wallet.address || wallet.displayAddress;
    }
    if (qrImage) {
      if (wallet.address && wallet.qrData) {
        const qrData = wallet.qrData(orderCode);
        qrImage.hidden = false;
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(qrData)}`;
      } else {
        qrImage.hidden = true;
        qrImage.removeAttribute("src");
      }
    }
    if (walletCard) {
      walletCard.classList.toggle("is-missing-wallet", !wallet.address);
    }
    if (cryptoWarning) {
      cryptoWarning.hidden = !wallet.warning;
      cryptoWarning.textContent = wallet.warning || "";
    }
    if (copyWalletButton) {
      copyWalletButton.disabled = !wallet.address;
      const label = copyWalletButton.querySelector("span");
      if (label) {
        label.textContent = wallet.address ? translateOriginal("Copia indirizzo") : translate("wallet-missing");
      }
    }

    updatePaymentPacket();
  }

  function setPaymentMethod(method) {
    const isCrypto = method === "crypto";

    paymentInputs.forEach((input) => {
      input.checked = input.value === method;
    });

    paymentOptions.forEach((option) => {
      const input = option.querySelector("input");
      option.classList.toggle("is-active", Boolean(input && input.value === method));
    });

    if (cryptoPanel) {
      cryptoPanel.hidden = !isCrypto;
    }
    if (codPanel) {
      codPanel.hidden = isCrypto;
    }
    if (paymentSummary) {
      paymentSummary.textContent = isCrypto ? `Crypto ${cryptoWallets[selectedCrypto].title}` : translate("cod");
    }
    if (checkoutNote) {
      checkoutNote.textContent = isCrypto
        ? translate("crypto-note")
        : translate("no-online-payment");
    }

    updatePaymentPacket();
  }

  paymentInputs.forEach((input) => {
    input.addEventListener("change", () => setPaymentMethod(input.value));
  });

  cryptoButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setCryptoOption(button.dataset.cryptoOption);
      setPaymentMethod("crypto");
    });
  });

  document.querySelectorAll(".checkout-form input").forEach((input) => {
    input.addEventListener("input", updatePaymentPacket);
  });

  const copyOrderButton = document.querySelector("[data-copy-order-code]");
  if (copyOrderButton) {
    copyOrderButton.addEventListener("click", () => copyText(orderCode, copyOrderButton));
  }

  if (copyWalletButton) {
    copyWalletButton.addEventListener("click", () => {
      const wallet = cryptoWallets[selectedCrypto];
      if (!wallet.address) {
        return;
      }

      copyText(wallet.address, copyWalletButton);
    });
  }

  const copyPacketButton = document.querySelector("[data-copy-payment-packet]");
  if (copyPacketButton) {
    copyPacketButton.addEventListener("click", () => {
      copyText(paymentPacket ? paymentPacket.value : "", copyPacketButton);
    });
  }

  setCryptoOption(selectedCrypto);
  setPaymentMethod(paymentInputs.find((input) => input.checked)?.value || "cod");
  refreshCheckoutProducts();
  window.addEventListener("haller-cart-change", refreshCheckoutProducts);
}

function collectCheckoutProducts() {
  const cartItems = readCartItems();
  if (cartItems.length > 0) {
    return cartItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      size: item.size || "",
      quantity: 1,
    }));
  }

  const item = readCheckoutItem();
  return item && item.name ? [{ id: item.id, name: item.name, price: item.price, size: item.size || "", quantity: 1 }] : [];
}

function checkoutField(name) {
  const field = document.querySelector(`[name="${name}"]`);
  return field ? field.value.trim() : "";
}

function selectedPaymentLabel() {
  const selected = document.querySelector('input[name="payment-method"]:checked');
  if (!selected || selected.value === "cod") return translate("cod");
  const selectedCrypto = document.querySelector("[data-crypto-option].is-active span:last-child");
  return selectedCrypto ? `Crypto ${selectedCrypto.textContent.trim()}` : "Crypto";
}

async function confirmCheckoutOrder(button) {
  if (!button) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = translate("confirming-order");
  const ids = trackingIds();

  const payload = {
    visitorId: ids.visitorId,
    sessionId: ids.sessionId,
    orderCode: readOrderCode(),
    customer: {
      name: checkoutField("name"),
      phone: checkoutField("phone"),
      email: checkoutField("email"),
      address: checkoutField("address"),
      city: checkoutField("city"),
      postalCode: checkoutField("postal-code"),
    },
    paymentMethod: selectedPaymentLabel(),
    txHash: checkoutField("tx-hash"),
    discountCode: checkoutField("discount-code"),
    products: collectCheckoutProducts(),
    deviceInfo: currentDeviceInfo(),
    preciseLocation: currentPreciseLocation(),
    language: siteLanguage,
  };

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || translate("order-not-saved"));

    sendTrack("order_confirmed", {
      method: payload.paymentMethod,
      product: payload.products.map((product) => product.name).join("; "),
    });
    recordReplay("order", {
      target: data.order.orderCode,
      text: payload.paymentMethod,
      depth: currentScrollDepth(),
    });
    flushReplay("order");

    window.localStorage.removeItem(cartItemsKey);
    window.localStorage.removeItem(cartKey);
    updateCartCount(0);
    renderBundleTryOn();

    const note = document.querySelector("[data-checkout-note]");
    if (note) {
      note.textContent = translate("order-confirmed-note")
        .replace("{code}", data.order.orderCode)
        .replace("{total}", data.order.total);
    }
    button.textContent = translate("order-confirmed");
  } catch (error) {
    const note = document.querySelector("[data-checkout-note]");
    if (note) {
      note.textContent = error.message || translate("order-save-failed");
    }
    button.disabled = false;
    button.textContent = originalText;
  }
}

renderCatalog();
renderProductDetail();
loadProductOverrides();
updateCartCount();
setupLocationDeliveryBanner();
setSiteMotion(true, true);

if (!isReplayView) {
  renderConsentManager();
  const existingConsent = readConsent();
  if (existingConsent?.analytics) {
    syncConsentServer(existingConsent).finally(startConsentedTracking);
  }
}

window.addEventListener("scroll", currentScrollDepth, { passive: true });
window.setInterval(() => {
  sendTrack("heartbeat");
}, 30000);

window.addEventListener("pagehide", () => {
  flushReplay("pagehide");
  sendTrack("page_exit");
});

if (window.lucide) {
  window.lucide.createIcons();
}

function applySiteLanguage(language) {
  siteLanguage = translations[language] ? language : "it";
  document.documentElement.lang = siteLanguage;
  translatePage();
  renderCatalog();
  renderProductDetail();
  renderCheckoutProductSummary();
  refreshCatalogSearchLanguage();
  const tryOnTitle = document.querySelector("[data-tryon-title]");
  if (tryOnTitle) {
    tryOnTitle.textContent = tryOnProduct
      ? translate("tryon-product-name").replace("{product}", tryOnProduct.name)
      : translate("tryon-product");
  }
  renderBundleTryOn();
}

applySiteLanguage(siteLanguage);
ensureCatalogSearch();
const initialCatalogGender = window.location.hash.replace("#", "");
if (["uomo", "donna"].includes(initialCatalogGender)) {
  catalogState = { gender: initialCatalogGender, category: "", brand: "", productIds: [] };
  renderCatalog();
}
window.addEventListener("haller-language-change", (event) => applySiteLanguage(event.detail));

if (slides.length > 0) {
  window.setInterval(() => {
    showSlide((active + 1) % slides.length);
  }, 5200);
}

document.addEventListener("click", (event) => {
  const searchButton = event.target.closest(".search-button");
  const searchClose = event.target.closest("[data-catalog-search-close]");
  const searchResult = event.target.closest("[data-catalog-search-result]");
  const navToggle = event.target.closest("[data-catalog-nav-toggle]");
  const catalogFilter = event.target.closest("[data-catalog-filter]");
  const catalogReset = event.target.closest("[data-catalog-reset]");
  const sizeOption = event.target.closest("[data-size-option]");
  const tryOnButton = event.target.closest("[data-try-on]");
  const addButton = event.target.closest("[data-add-to-cart]");
  const buyButton = event.target.closest("[data-buy-now]");
  const checkoutRemoveButton = event.target.closest("[data-checkout-remove-index]");
  const lastStockButton = event.target.closest("[data-last-stock-gender]");
  const galleryDot = event.target.closest("[data-gallery-dot]");
  const gallerySurfaceClick = event.target.closest("[data-gallery-click], .product-media-open");
  const productCard = event.target.closest("[data-product-url]");

  if (galleryDot) {
    event.preventDefault();
    selectProductGallerySlide(galleryDot);
    return;
  }

  if (gallerySurfaceClick && event.detail !== 0) {
    const gallery = gallerySurfaceClick.closest(".product-media, .product-detail-gallery");
    if (gallery?.querySelectorAll("[data-gallery-slide]").length > 1) {
      event.preventDefault();
      const galleryBounds = gallery.getBoundingClientRect();
      const direction = event.clientX < galleryBounds.left + galleryBounds.width / 2 ? -1 : 1;
      stepProductGallery(gallery, direction);
      return;
    }
  }

  if (lastStockButton) {
    lastStockGender = lastStockButton.dataset.lastStockGender;
    renderLastStockCatalog();
    return;
  }

  if (searchButton) {
    ensureCatalogSearch();
    const dialog = document.querySelector("[data-catalog-search-dialog]");
    if (dialog && !dialog.open) dialog.showModal();
    const input = document.querySelector("[data-catalog-search-input]");
    renderCatalogSearchResults(input?.value || "");
    window.setTimeout(() => input?.focus(), 0);
  }

  if (searchClose) document.querySelector("[data-catalog-search-dialog]")?.close();

  if (searchResult) {
    const productId = searchResult.dataset.catalogSearchResult;
    const product = findProductById(productId);
    if (product) window.location.href = productPageUrl(product);
    return;
  }

  if (navToggle) {
    const panel = document.querySelector(`[data-catalog-nav-panel="${navToggle.dataset.catalogNavToggle}"]`);
    const shouldOpen = panel?.hidden;
    closeCatalogNavPanels();
    if (panel && shouldOpen) {
      panel.hidden = false;
      navToggle.setAttribute("aria-expanded", "true");
    }
  }

  if (catalogFilter) {
    catalogState = {
      gender: catalogFilter.dataset.catalogGender || "",
      category: catalogFilter.dataset.catalogCategory || "",
      brand: catalogFilter.dataset.catalogBrand || "",
      productIds: [],
    };
    closeCatalogNavPanels();
    renderCatalog();
    document.querySelector("#selezione")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (catalogReset) {
    catalogState = { gender: "", category: "", brand: "", productIds: [] };
    renderCatalog();
  }

  if (checkoutRemoveButton) {
    removeCheckoutItem(checkoutRemoveButton.dataset.checkoutRemoveIndex);
    return;
  }

  if (sizeOption) {
    const group = sizeOption.closest(".product-sizes");
    group?.querySelectorAll("[data-size-option]").forEach((option) => option.classList.remove("is-selected"));
    sizeOption.classList.add("is-selected");
  }

  if (tryOnButton) {
    openTryOnModal(tryOnButton.dataset.tryOn);
  }

  if (addButton) {
    addToCart(addButton);
  }

  if (buyButton) {
    addToCart(buyButton);
    window.location.href = "checkout.html";
    return;
  }

  if (productCard && !event.target.closest("button, a, input, label")) {
    window.location.href = productCard.dataset.productUrl;
  }
});

const checkoutSubmitButton = document.querySelector(".checkout-submit");
if (checkoutSubmitButton) {
  checkoutSubmitButton.addEventListener("click", () => confirmCheckoutOrder(checkoutSubmitButton));
}

const discountButton = document.querySelector("[data-discount-apply]");
const discountInput = document.querySelector("input[name='discount-code']");
const discountMessage = document.querySelector(".discount-message");

if (discountButton && discountInput && discountMessage) {
  discountButton.addEventListener("click", () => {
    const code = discountInput.value.trim();

    discountMessage.textContent = code
      ? translate("discount-applied")
      : translate("discount-empty");
  });
}

setupCheckoutPayments();
setupBundleTryOn();

const chatProfileKey = "hallerBoutiqueChatProfile";
let chatHistory = [];

function readChatProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem(chatProfileKey));
    return profile && typeof profile === "object" ? profile : null;
  } catch {
    return null;
  }
}

function getChatCatalog() {
  return getAllProducts().map((product) => ({
    name: product.name,
    category: product.category,
    collection: product.collection,
    description: product.description,
    finalPrice: product.finalPrice,
    sizes: getSizes(product),
  }));
}

function appendChatMessage(messages, role, text) {
  messages.insertAdjacentHTML("beforeend", `<p class="site-chat-message site-chat-message-${role}">${escapeHtml(text)}</p>`);
  messages.scrollTop = messages.scrollHeight;
}

function setupSiteChat() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <section class="site-chat" data-site-chat aria-label="Assistente virtuale Haller Boutique" data-i18n-aria-label="chat-label">
        <button class="site-chat-launcher" type="button" data-chat-toggle aria-expanded="false" aria-controls="site-chat-panel" aria-label="Apri assistente virtuale" data-i18n-aria-label="chat-open">
          <img src="assets/chat-assistant-avatar.png" alt="Ritratto di Aurora, assistente virtuale" data-i18n-alt="chat-avatar-alt" draggable="false">
          <span class="site-chat-online-copy"><strong>Aurora</strong><small data-i18n="chat-online">Online</small></span>
          <i class="site-chat-online-dot" aria-hidden="true"></i>
        </button>
        <div class="site-chat-panel" id="site-chat-panel" data-chat-panel hidden>
          <header class="site-chat-header">
            <img src="assets/chat-assistant-avatar.png" alt="Ritratto di Aurora, assistente virtuale" data-i18n-alt="chat-avatar-alt" draggable="false">
            <div><strong>Aurora</strong><span data-i18n="chat-status">Assistente online</span></div>
            <button type="button" data-chat-toggle aria-label="Chiudi assistente virtuale" data-i18n-aria-label="chat-close"><i data-lucide="x"></i></button>
          </header>
          <form class="site-chat-profile" data-chat-profile>
            <p data-i18n="chat-intro">Prima di iniziare, lasciami i tuoi dati per seguirti meglio.</p>
            <div class="site-chat-profile-grid">
              <label><span data-i18n="first-name">Nome</span><input name="firstName" autocomplete="given-name" required></label>
              <label><span data-i18n="last-name">Cognome</span><input name="lastName" autocomplete="family-name" required></label>
            </div>
            <label><span data-i18n="email">Email</span><input name="email" type="email" autocomplete="email" required></label>
            <label><span data-i18n="phone">Cellulare</span> <em data-i18n="optional">facoltativo</em><input name="phone" type="tel" autocomplete="tel"></label>
            <small data-i18n="chat-privacy">I dati vengono usati solo per offrirti assistenza in questa conversazione.</small>
            <button type="submit" data-i18n="chat-start">Inizia la chat</button>
          </form>
          <div class="site-chat-conversation" data-chat-conversation hidden>
            <div class="site-chat-messages" data-chat-messages aria-live="polite"></div>
            <div class="site-chat-actions">
              <button type="button" data-chat-prompt-key="chat-prompt-sizes" data-i18n="chat-sizes">Taglie</button>
              <button type="button" data-chat-prompt-key="chat-prompt-order" data-i18n="chat-track-order">Segui ordine</button>
            </div>
            <form class="site-chat-composer" data-chat-composer>
              <input data-chat-input maxlength="900" placeholder="Scrivi qui..." data-i18n-placeholder="chat-placeholder" autocomplete="off" required>
              <button type="submit" aria-label="Invia messaggio" data-i18n-aria-label="chat-send"><i data-lucide="send"></i></button>
            </form>
          </div>
        </div>
      </section>
    `
  );

  const root = document.querySelector("[data-site-chat]");
  const panel = root.querySelector("[data-chat-panel]");
  const profileForm = root.querySelector("[data-chat-profile]");
  const conversation = root.querySelector("[data-chat-conversation]");
  const messages = root.querySelector("[data-chat-messages]");
  const composer = root.querySelector("[data-chat-composer]");
  const input = root.querySelector("[data-chat-input]");
  let profile = readChatProfile();
  translatePage();

  const showConversation = () => {
    profileForm.hidden = true;
    conversation.hidden = false;
    if (!messages.children.length) {
      appendChatMessage(messages, "assistant", translate("chat-greeting").replace("{name}", profile.firstName));
    }
  };

  const openChat = () => {
    panel.hidden = false;
    root.querySelector(".site-chat-launcher").setAttribute("aria-expanded", "true");
    if (profile) showConversation();
  };

  root.querySelectorAll("[data-chat-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const isOpen = panel.hidden;
      if (isOpen) openChat();
      else {
        panel.hidden = true;
        root.querySelector(".site-chat-launcher").setAttribute("aria-expanded", "false");
      }
    });
  });

  if (profile) {
    ["firstName", "lastName", "email", "phone"].forEach((name) => {
      const field = profileForm.elements.namedItem(name);
      if (field) field.value = profile[name] || "";
    });
  }

  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(profileForm));
    profile = {
      firstName: String(values.firstName || "").trim(),
      lastName: String(values.lastName || "").trim(),
      email: String(values.email || "").trim(),
      phone: String(values.phone || "").trim(),
    };
    localStorage.setItem(chatProfileKey, JSON.stringify(profile));
    showConversation();
    input.focus();
  });

  const sendMessage = async (message) => {
    const text = String(message || "").trim();
    if (!text || !profile) return;
    appendChatMessage(messages, "user", text);
    chatHistory.push({ role: "user", content: text });
    input.value = "";
    input.disabled = true;
    appendChatMessage(messages, "assistant", translate("chat-thinking"));
    const pending = messages.lastElementChild;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, message: text, history: chatHistory.slice(0, -1), catalog: getChatCatalog(), language: siteLanguage }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || translate("chat-error"));
      pending.textContent = data.reply;
      chatHistory.push({ role: "assistant", content: data.reply });
    } catch (error) {
      pending.textContent = error.message || translate("chat-error");
    } finally {
      input.disabled = false;
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }
  };

  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });
  root.querySelectorAll("[data-chat-prompt-key]").forEach((button) => {
    button.addEventListener("click", () => sendMessage(translate(button.dataset.chatPromptKey)));
  });
  document.querySelectorAll("[data-open-chat]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    openChat();
  }));
  if (new URLSearchParams(window.location.search).get("chat") === "1") openChat();
  if (window.lucide) window.lucide.createIcons();
}

setupSiteChat();
