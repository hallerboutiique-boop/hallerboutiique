(() => {
  const preferenceKey = "hallerBoutiqueReadAloud";
  const supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  let enabled = localStorage.getItem(preferenceKey) === "1";
  let speechRun = 0;

  const copy = {
    it: { on: "Attiva lettura vocale", off: "Disattiva lettura vocale", ready: "Lettura vocale attiva. Tocca un testo per ascoltarlo.", unavailable: "La lettura vocale non e disponibile su questo browser." },
    en: { on: "Enable read aloud", off: "Disable read aloud", ready: "Read aloud is on. Tap any text to hear it.", unavailable: "Read aloud is not available in this browser." },
    fr: { on: "Activer la lecture vocale", off: "Desactiver la lecture vocale", ready: "La lecture vocale est active. Touchez un texte pour l'ecouter.", unavailable: "La lecture vocale n'est pas disponible dans ce navigateur." },
    de: { on: "Vorlesefunktion aktivieren", off: "Vorlesefunktion deaktivieren", ready: "Die Vorlesefunktion ist aktiv. Tippen Sie auf einen Text, um ihn anzuhoren.", unavailable: "Die Vorlesefunktion ist in diesem Browser nicht verfugbar." },
    es: { on: "Activar lectura en voz alta", off: "Desactivar lectura en voz alta", ready: "La lectura en voz alta esta activa. Toca un texto para escucharlo.", unavailable: "La lectura en voz alta no esta disponible en este navegador." }
  };

  function language() {
    const selected = localStorage.getItem("haller-language") || document.documentElement.lang || "it";
    return copy[selected] ? selected : "it";
  }

  function label(key) {
    return copy[language()][key];
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function splitText(value, maxLength = 220) {
    const text = cleanText(value);
    if (!text) return [];
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    const chunks = [];
    let current = "";
    sentences.forEach((sentence) => {
      const next = cleanText(`${current} ${sentence}`);
      if (current && next.length > maxLength) {
        chunks.push(current);
        current = cleanText(sentence);
      } else {
        current = next;
      }
    });
    if (current) chunks.push(current);
    return chunks;
  }

  function preferredVoice() {
    const code = language();
    const prefix = { it: "it", en: "en", fr: "fr", de: "de", es: "es" }[code];
    return window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith(prefix)) || null;
  }

  function speak(values) {
    if (!supported || !enabled) return;
    const run = ++speechRun;
    const chunks = values.flatMap((value) => splitText(value)).filter(Boolean);
    window.speechSynthesis.cancel();

    const play = (index) => {
      if (!enabled || run !== speechRun || index >= chunks.length) return;
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.lang = { it: "it-IT", en: "en-GB", fr: "fr-FR", de: "de-DE", es: "es-ES" }[language()];
      utterance.rate = 0.95;
      utterance.pitch = 1;
      const voice = preferredVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => play(index + 1);
      utterance.onerror = () => play(index + 1);
      window.speechSynthesis.speak(utterance);
    };

    play(0);
  }

  function readablePageText() {
    const root = document.querySelector("main") || document.body;
    const selector = "h1, h2, h3, p, li, label, .product-body strong, .product-detail-copy strong";
    const seen = new Set();
    return [...root.querySelectorAll(selector)].filter((element) => {
      if (element.closest("[hidden], [aria-hidden='true'], .site-chat, .catalog-search-dialog, [data-cookie-banner]")) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    }).map((element) => cleanText(element.textContent)).filter((text) => {
      if (!text || seen.has(text)) return false;
      seen.add(text);
      return true;
    });
  }

  function updateButton(button) {
    button.classList.toggle("is-active", enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("aria-label", supported ? label(enabled ? "off" : "on") : label("unavailable"));
    button.title = supported ? label(enabled ? "off" : "on") : label("unavailable");
    button.disabled = !supported;
    button.innerHTML = `<i data-lucide="${enabled ? "volume-2" : "volume-1"}"></i>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function createButton() {
    const button = document.createElement("button");
    button.className = "icon-button read-aloud-button";
    button.type = "button";
    button.dataset.readAloudToggle = "";
    return button;
  }

  function mountButton() {
    let button = document.querySelector("[data-read-aloud-toggle]");
    if (!button) {
      button = createButton();
      const search = document.querySelector(".search-button");
      const actions = document.querySelector(".site-header .header-actions");
      const legalLanguage = document.querySelector(".legal-language-picker");
      if (search) search.before(button);
      else if (actions) actions.prepend(button);
      else if (legalLanguage) legalLanguage.prepend(button);
      else return;
    }

    updateButton(button);
    document.body.classList.toggle("read-aloud-enabled", enabled);

    button.addEventListener("click", () => {
      enabled = !enabled;
      localStorage.setItem(preferenceKey, enabled ? "1" : "0");
      document.body.classList.toggle("read-aloud-enabled", enabled);
      updateButton(button);
      if (!enabled) {
        speechRun += 1;
        window.speechSynthesis.cancel();
        return;
      }
      speak([label("ready"), ...readablePageText()]);
    });
  }

  document.addEventListener("click", (event) => {
    if (!enabled || event.target.closest("[data-read-aloud-toggle]")) return;
    const target = event.target.closest("main h1, main h2, main h3, main p, main li, main label, main a, main button, main strong");
    if (target) speak([target.textContent]);
  });

  window.addEventListener("pagehide", () => {
    speechRun += 1;
    if (supported) window.speechSynthesis.cancel();
  });

  window.HallerReadAloud = { speak, isEnabled: () => enabled };
  mountButton();
  window.addEventListener("haller-language-change", () => {
    const button = document.querySelector("[data-read-aloud-toggle]");
    if (button) updateButton(button);
  });
})();
