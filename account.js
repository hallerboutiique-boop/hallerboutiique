const authTabs = document.querySelectorAll("[data-auth-tab]");
const authForms = document.querySelectorAll("[data-auth-form]");
const authMessage = document.querySelector("[data-auth-message]");
const formsWrap = document.querySelectorAll("[data-auth-forms]");
const profileCard = document.querySelector("[data-auth-profile]");
const profileName = document.querySelector("[data-profile-name]");
const profileEmail = document.querySelector("[data-profile-email]");
const profilePhone = document.querySelector("[data-profile-phone]");
const oauthNote = document.querySelector("[data-oauth-note]");

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
  if (!response.ok || data.ok === false) throw new Error(data.message || "Operazione non riuscita.");
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
  profileName.textContent = user.name || "Cliente";
  profileEmail.textContent = user.email || "";
  profilePhone.textContent = user.phone ? `Cellulare: ${user.phone}` : "Cellulare non inserito";
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
  if (oauthNote && missing.length) {
    oauthNote.textContent = `Accesso ${missing.join(", ")} pronto nel sito, da attivare con le credenziali OAuth.`;
  }
}

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => showTab(tab.dataset.authTab));
});

authForms.forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    const isRegister = form.dataset.authForm === "register";
    setMessage("Operazione in corso...");
    try {
      await api(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessage(isRegister ? "Account creato." : "Accesso effettuato.", "success");
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
  const names = { google: "Google", microsoft: "Microsoft", apple: "Apple" };
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
  };
  const providerName = names[provider] || "Social";
  setMessage(`${providerName}: ${messages[error] || "accesso non completato."}`, "error");
}

loadProviders().catch(() => {});
loadMe().catch(() => showProfile(null));

if (window.lucide) {
  window.lucide.createIcons();
}
