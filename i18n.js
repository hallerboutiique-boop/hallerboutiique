(() => {
  const languageKey = "haller-language";
  const names = { it: "Italiano", en: "English", fr: "Francais", de: "Deutsch", es: "Espanol" };
  const text = {
    it: {},
    en: {
      "Torna alla home": "Back to home", "Home": "Home", "Contatti": "Contact", "Area clienti": "Customer area", "Accedi o registrati": "Sign in or register", "Accedi": "Sign in", "Registrati": "Register", "Esci": "Sign out", "Crea account": "Create account", "Account attivo": "Active account", "Accesso rapido": "Quick sign-in", "Continua con": "Continue with", "Checkout": "Checkout", "Pagamento alla consegna o crypto": "Cash on delivery or crypto", "Dati cliente": "Customer details", "Nome e cognome": "Full name", "Telefono": "Phone", "Indirizzo di consegna": "Delivery address", "Indirizzo": "Address", "Citta": "City", "Codice sconto": "Discount code", "Inserisci codice": "Enter code", "Applica sconto": "Apply discount", "Pagamento": "Payment", "Contrassegno": "Cash on delivery", "Puoi pagare direttamente al corriere quando ricevi il pacco.": "You can pay the courier directly when your parcel arrives.", "Codice ordine": "Order code", "Copia": "Copy", "Copia indirizzo": "Copy address", "Tracciamento pagamento": "Payment tracking", "TX hash pagamento": "Payment TX hash", "Copia dati pagamento": "Copy payment details", "Conferma ordine": "Confirm order", "Riepilogo": "Summary", "Prodotto": "Product", "Metodo di pagamento": "Payment method", "Consegna": "Delivery", "Continua lo shopping": "Continue shopping", "Pannello riservato": "Restricted area", "Dashboard admin": "Admin dashboard", "Password admin": "Admin password", "Entra": "Sign in", "Aggiorna": "Refresh", "Metriche": "Metrics", "Ordini": "Orders", "Prodotti": "Products", "Utenti": "Users", "Video": "Video", "Attivita": "Activity", "Visite live": "Live visits", "Pagamenti": "Payments", "Tutti i diritti riservati.": "All rights reserved."
    },
    fr: {
      "Torna alla home": "Retour a l'accueil", "Home": "Accueil", "Contatti": "Contact", "Area clienti": "Espace client", "Accedi o registrati": "Connexion ou inscription", "Accedi": "Se connecter", "Registrati": "S'inscrire", "Esci": "Se deconnecter", "Crea account": "Creer un compte", "Account attivo": "Compte actif", "Accesso rapido": "Connexion rapide", "Continua con": "Continuer avec", "Checkout": "Paiement", "Pagamento alla consegna o crypto": "Paiement a la livraison ou crypto", "Dati cliente": "Informations client", "Nome e cognome": "Nom complet", "Telefono": "Telephone", "Indirizzo di consegna": "Adresse de livraison", "Indirizzo": "Adresse", "Citta": "Ville", "Codice sconto": "Code promotionnel", "Inserisci codice": "Saisir le code", "Applica sconto": "Appliquer", "Pagamento": "Paiement", "Contrassegno": "Paiement a la livraison", "Puoi pagare direttamente al corriere quando ricevi il pacco.": "Payez directement le transporteur a la reception du colis.", "Codice ordine": "Numero de commande", "Copia": "Copier", "Copia indirizzo": "Copier l'adresse", "Tracciamento pagamento": "Suivi du paiement", "TX hash pagamento": "TX hash du paiement", "Copia dati pagamento": "Copier les donnees", "Conferma ordine": "Confirmer la commande", "Riepilogo": "Recapitulatif", "Prodotto": "Produit", "Metodo di pagamento": "Moyen de paiement", "Consegna": "Livraison", "Continua lo shopping": "Continuer vos achats", "Pannello riservato": "Espace reserve", "Dashboard admin": "Tableau de bord admin", "Password admin": "Mot de passe admin", "Entra": "Se connecter", "Aggiorna": "Actualiser", "Metriche": "Indicateurs", "Ordini": "Commandes", "Prodotti": "Produits", "Utenti": "Utilisateurs", "Video": "Videos", "Attivita": "Activite", "Visite live": "Visites en direct", "Pagamenti": "Paiements", "Tutti i diritti riservati.": "Tous droits reserves."
    },
    de: {
      "Torna alla home": "Zuruck zur Startseite", "Home": "Startseite", "Contatti": "Kontakt", "Area clienti": "Kundenbereich", "Accedi o registrati": "Anmelden oder registrieren", "Accedi": "Anmelden", "Registrati": "Registrieren", "Esci": "Abmelden", "Crea account": "Konto erstellen", "Account attivo": "Aktives Konto", "Accesso rapido": "Schnell anmelden", "Continua con": "Weiter mit", "Checkout": "Kasse", "Pagamento alla consegna o crypto": "Nachnahme oder Krypto", "Dati cliente": "Kundendaten", "Nome e cognome": "Vollstandiger Name", "Telefono": "Telefon", "Indirizzo di consegna": "Lieferadresse", "Indirizzo": "Adresse", "Citta": "Stadt", "Codice sconto": "Rabattcode", "Inserisci codice": "Code eingeben", "Applica sconto": "Rabatt anwenden", "Pagamento": "Zahlung", "Contrassegno": "Nachnahme", "Puoi pagare direttamente al corriere quando ricevi il pacco.": "Sie zahlen direkt beim Zusteller, wenn das Paket ankommt.", "Codice ordine": "Bestellnummer", "Copia": "Kopieren", "Copia indirizzo": "Adresse kopieren", "Tracciamento pagamento": "Zahlungsverfolgung", "TX hash pagamento": "Zahlungs-TX-Hash", "Copia dati pagamento": "Zahlungsdaten kopieren", "Conferma ordine": "Bestellung bestatigen", "Riepilogo": "Zusammenfassung", "Prodotto": "Produkt", "Metodo di pagamento": "Zahlungsart", "Consegna": "Lieferung", "Continua lo shopping": "Weiter einkaufen", "Pannello riservato": "Geschutzter Bereich", "Dashboard admin": "Admin-Dashboard", "Password admin": "Admin-Passwort", "Entra": "Anmelden", "Aggiorna": "Aktualisieren", "Metriche": "Kennzahlen", "Ordini": "Bestellungen", "Prodotti": "Produkte", "Utenti": "Nutzer", "Video": "Videos", "Attivita": "Aktivitat", "Visite live": "Live-Besuche", "Pagamenti": "Zahlungen", "Tutti i diritti riservati.": "Alle Rechte vorbehalten."
    },
    es: {
      "Torna alla home": "Volver al inicio", "Home": "Inicio", "Contatti": "Contacto", "Area clienti": "Area de clientes", "Accedi o registrati": "Inicia sesion o registrate", "Accedi": "Iniciar sesion", "Registrati": "Registrarse", "Esci": "Cerrar sesion", "Crea account": "Crear cuenta", "Account attivo": "Cuenta activa", "Accesso rapido": "Acceso rapido", "Continua con": "Continuar con", "Checkout": "Pago", "Pagamento alla consegna o crypto": "Pago contra reembolso o cripto", "Dati cliente": "Datos del cliente", "Nome e cognome": "Nombre completo", "Telefono": "Telefono", "Indirizzo di consegna": "Direccion de entrega", "Indirizzo": "Direccion", "Citta": "Ciudad", "Codice sconto": "Codigo de descuento", "Inserisci codice": "Introduce el codigo", "Applica sconto": "Aplicar descuento", "Pagamento": "Pago", "Contrassegno": "Contra reembolso", "Puoi pagare direttamente al corriere quando ricevi il pacco.": "Puedes pagar directamente al mensajero al recibir el paquete.", "Codice ordine": "Codigo de pedido", "Copia": "Copiar", "Copia indirizzo": "Copiar direccion", "Tracciamento pagamento": "Seguimiento del pago", "TX hash pagamento": "TX hash del pago", "Copia dati pagamento": "Copiar datos de pago", "Conferma ordine": "Confirmar pedido", "Riepilogo": "Resumen", "Prodotto": "Producto", "Metodo di pagamento": "Metodo de pago", "Consegna": "Entrega", "Continua lo shopping": "Seguir comprando", "Pannello riservato": "Area restringida", "Dashboard admin": "Panel de administracion", "Password admin": "Contrasena admin", "Entra": "Entrar", "Aggiorna": "Actualizar", "Metriche": "Metricas", "Ordini": "Pedidos", "Prodotti": "Productos", "Utenti": "Usuarios", "Video": "Videos", "Attivita": "Actividad", "Visite live": "Visitas en directo", "Pagamenti": "Pagos", "Tutti i diritti riservati.": "Todos los derechos reservados."
    }
  };
  const originals = new WeakMap();
  const language = () => localStorage.getItem(languageKey) || "it";
  const translate = (value) => text[language()]?.[value] || value;
  const apply = () => {
    document.documentElement.lang = language();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement || ["SCRIPT", "STYLE"].includes(node.parentElement.tagName)) continue;
      const original = originals.get(node) ?? node.nodeValue;
      originals.set(node, original);
      const trimmed = original.trim();
      if (!trimmed) continue;
      const value = translate(trimmed);
      node.nodeValue = value === trimmed ? original : original.replace(trimmed, value);
    }
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = translate(element.dataset.i18nPlaceholder);
    });
  };
  const bindPicker = (picker) => {
    const toggle = picker.querySelector(".language-toggle");
    const menu = picker.querySelector(".language-menu");
    const options = picker.querySelectorAll("[data-language-option]");
    if (!toggle || !menu) return;
    const refresh = () => {
      const current = language();
      options.forEach((option) => option.setAttribute("aria-checked", String(option.dataset.languageOption === current)));
      toggle.setAttribute("aria-label", `Change language: ${names[current]}`);
    };
    refresh();
    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    options.forEach((option) => option.addEventListener("click", () => {
      localStorage.setItem(languageKey, option.dataset.languageOption);
      refresh();
      apply();
      window.dispatchEvent(new CustomEvent("haller-language-change", { detail: option.dataset.languageOption }));
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }));
  };
  window.HallerI18n = { apply, translate, language };
  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.querySelectorAll("[data-language-picker]").forEach(bindPicker);
  });
  window.addEventListener("haller-language-change", apply);
})();
