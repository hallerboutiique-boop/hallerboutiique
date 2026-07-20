const authTabs = document.querySelectorAll("[data-auth-tab]");
const authForms = document.querySelectorAll("[data-auth-form]");
const authMessage = document.querySelector("[data-auth-message]");
const formsWrap = document.querySelectorAll("[data-auth-forms]");
const profileCard = document.querySelector("[data-auth-profile]");
const profileName = document.querySelector("[data-profile-name]");
const profileEmail = document.querySelector("[data-profile-email]");
const profilePhone = document.querySelector("[data-profile-phone]");
const oauthNote = document.querySelector("[data-oauth-note]");
let missingOauthProviders = [];

const accountCopy = {
  it: { customer: "Cliente", phone: "Cellulare: {value}", phoneMissing: "Cellulare non inserito", oauth: "Accesso {providers} pronto nel sito, da attivare con le credenziali OAuth.", working: "Operazione in corso...", created: "Account creato.", signedIn: "Accesso effettuato.", failed: "Operazione non riuscita." },
  en: { customer: "Customer", phone: "Phone: {value}", phoneMissing: "Phone number not provided", oauth: "{providers} sign-in is ready on the site and only needs the OAuth credentials.", working: "Working...", created: "Account created.", signedIn: "Signed in.", failed: "Operation failed." },
  fr: { customer: "Client", phone: "Telephone : {value}", phoneMissing: "Telephone non renseigne", oauth: "La connexion {providers} est prete sur le site et necessite seulement les identifiants OAuth.", working: "Operation en cours...", created: "Compte cree.", signedIn: "Connexion reussie.", failed: "Echec de l'operation." },
  de: { customer: "Kunde", phone: "Telefon: {value}", phoneMissing: "Telefonnummer nicht angegeben", oauth: "Die Anmeldung mit {providers} ist vorbereitet und benotigt nur noch die OAuth-Zugangsdaten.", working: "Vorgang lauft...", created: "Konto erstellt.", signedIn: "Anmeldung erfolgreich.", failed: "Vorgang fehlgeschlagen." },
  es: { customer: "Cliente", phone: "Telefono: {value}", phoneMissing: "Telefono no indicado", oauth: "El acceso con {providers} esta listo y solo necesita las credenciales OAuth.", working: "Operacion en curso...", created: "Cuenta creada.", signedIn: "Sesion iniciada.", failed: "La operacion ha fallado." },
  sq: { customer: "Klient", phone: "Telefoni: {value}", phoneMissing: "Numri i telefonit nuk eshte vendosur", oauth: "Hyrja me {providers} eshte gati ne faqe dhe kerkon vetem kredencialet OAuth.", working: "Veprimi ne proces...", created: "Llogaria u krijua.", signedIn: "Hyrja u krye.", failed: "Veprimi deshtoi." },
  ro: { customer: "Client", phone: "Telefon: {value}", phoneMissing: "Numarul de telefon nu a fost introdus", oauth: "Autentificarea cu {providers} este pregatita pe site si necesita doar datele OAuth.", working: "Operatiune in curs...", created: "Cont creat.", signedIn: "Autentificare reusita.", failed: "Operatiunea a esuat." },
};

function accountText(key, replacements = {}) {
  const language = window.HallerI18n?.language?.() || "it";
  return Object.entries(replacements).reduce(
    (value, [name, replacement]) => value.replace(`{${name}}`, replacement),
    accountCopy[language]?.[key] || accountCopy.it[key] || key
  );
}

function renderOauthNote() {
  if (!oauthNote) return;
  oauthNote.textContent = missingOauthProviders.length
    ? accountText("oauth", { providers: missingOauthProviders.join(", ") })
    : "";
}

function setMessage(message, type = "") {
  if (!authMessage) return;
  authMessage.textContent = message || "";
  authMessage.dataset.type = type;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.message || accountText("failed"));
  return data;
}

function showTab(name) {
  authTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.authTab === name));
  authForms.forEach((form) => form.classList.toggle("is-active", form.dataset.authForm === name));
  setMessage("");
}

function showProfile(user) {
  const logged = Boolean(user);
  formsWrap.forEach((block) => {
    block.hidden = logged;
  });
  if (profileCard) profileCard.hidden = !logged;
  if (!user) return;
  profileName.textContent = user.name || accountText("customer");
  profileEmail.textContent = user.email || "";
  profilePhone.textContent = user.phone ? accountText("phone", { value: user.phone }) : accountText("phoneMissing");
}

async function loadMe() {
  const data = await api("/api/auth/me");
  showProfile(data.user);
}

async function loadProviders() {
  const data = await api("/api/auth/providers");
  const missing = [];
  Object.entries(data.providers).forEach(([key, provider]) => {
    const button = document.querySelector(`[data-oauth-provider="${key}"]`);
    if (!button) return;
    button.classList.toggle("is-disabled", !provider.configured);
    if (!provider.configured) missing.push(provider.label);
  });
  missingOauthProviders = missing;
  renderOauthNote();
}

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => showTab(tab.dataset.authTab));
});

authForms.forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    const isRegister = form.dataset.authForm === "register";
    setMessage(accountText("working"));
    try {
      await api(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessage(accountText(isRegister ? "created" : "signedIn"), "success");
      await loadMe();
    } catch (error) {
      setMessage(error.message, "error");
    }
  });
});

document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST", body: "{}" });
  showProfile(null);
});

const params = new URLSearchParams(window.location.search);
if (params.get("error") || params.get("oauth")) {
  const provider = params.get("oauth");
  const error = params.get("error");
  const names = { google: "Google", microsoft: "Microsoft" };
  const messages = {
    token: "credenziali, secret o redirect URI non accettati dal provider.",
    userinfo: "il provider non ha restituito il profilo utente.",
    email: "il provider non ha restituito una email utilizzabile.",
    oauth_state: "sessione di accesso scaduta, riprova.",
    oauth_code: "codice di accesso mancante, riprova.",
    id_token_missing_subject: "token Microsoft senza identificativo utente.",
    id_token_audience: "client ID Microsoft non coerente con il token.",
    id_token_expired: "token Microsoft scaduto, riprova.",
    not_configured: "provider non configurato.",
    unauthorized_client: "app Microsoft non abilitata per questo tipo di account.",
    invalid_request: "richiesta Microsoft non accettata.",
    "70002": "Microsoft richiede il client secret per questa app.",
  };
  const providerName = names[provider] || "Social";
  const detail = params.get("detail");
  setMessage(`${providerName}: ${messages[error] || "accesso non completato."}${detail ? ` (${detail})` : ""}`, "error");
}

loadProviders().catch(() => {});
loadMe().catch(() => showProfile(null));
window.addEventListener("haller-language-change", renderOauthNote);

if (window.lucide) {
  window.lucide.createIcons();
}
