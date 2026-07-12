const adminLogin = document.querySelector("[data-admin-login]");
const adminPanel = document.querySelector("[data-admin-panel]");
const adminMessage = document.querySelector("[data-admin-message]");
const usersTable = document.querySelector("[data-users-table]");
const ordersTable = document.querySelector("[data-orders-table]");
const adminTotal = document.querySelector("[data-admin-total]");
const metricGrid = document.querySelector("[data-metric-grid]");
const replaySessionsRoot = document.querySelector("[data-replay-sessions]");
const replayPlayer = document.querySelector("[data-replay-player]");
let replayTimers = [];

function setAdminMessage(message, type = "") {
  if (!adminMessage) return;
  adminMessage.textContent = message || "";
  adminMessage.dataset.type = type;
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

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}€`;
}

function escapeHtml(value) {
  return String(value || "-").replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function emptyState(text) {
  return `<p class="admin-empty">${escapeHtml(text)}</p>`;
}

function deviceLine(session) {
  const model = session.deviceModel || session.device || "Dispositivo";
  const os = [session.os, session.osVersion].filter(Boolean).join(" ") || session.device || "";
  const browser = session.browser || "";
  const screen = session.screen ? `schermo ${session.screen}` : "";
  return [model, os, browser, screen].filter(Boolean).join(" · ");
}

function renderMetrics(metrics) {
  const kpi = metrics.kpis;
  const cards = [
    ["Visite live", kpi.liveVisitors, "ultimi 2 minuti"],
    ["Visitatori", kpi.visitors, `${kpi.visitors24h} nelle 24h`],
    ["Pageview", kpi.pageviews, `${kpi.pageviews24h} nelle 24h`],
    ["Conversione", `${(kpi.conversionRate * 100).toFixed(1)}%`, `${kpi.orders} ordini`],
    ["Checkout abbandonati", kpi.abandonedCheckouts, `${kpi.checkoutStarts} checkout avviati`],
    ["Incassi", formatMoney(kpi.revenue), `AOV ${formatMoney(kpi.averageOrderValue)}`],
    ["Tempo medio", formatDuration(kpi.averageDurationMs), "per sessione"],
    ["Utenti registrati", kpi.users, "account creati"],
  ];

  metricGrid.innerHTML = cards
    .map(
      ([label, value, detail]) => `
        <article class="metric-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(detail)}</p>
        </article>
      `
    )
    .join("");
}

function renderChart(selector, rows, valueLabel = "") {
  const root = document.querySelector(selector);
  if (!root) return;
  if (!rows || rows.length === 0) {
    root.innerHTML = emptyState("Nessun dato disponibile.");
    return;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);
  root.innerHTML = rows
    .map(
      (row) => `
        <div class="chart-row">
          <div>
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}${valueLabel}</strong>
          </div>
          <i style="--bar:${Math.max(4, Math.round((row.value / max) * 100))}%"></i>
        </div>
      `
    )
    .join("");
}

function renderLiveSessions(sessions) {
  const root = document.querySelector("[data-live-sessions]");
  if (!root) return;
  if (!sessions || sessions.length === 0) {
    root.innerHTML = emptyState("Nessun visitatore live.");
    return;
  }
  root.innerHTML = sessions
    .map(
      (session) => `
        <article class="live-session">
          <strong>${escapeHtml(session.path || "/")}</strong>
          <span>${escapeHtml(deviceLine(session))} · IP ${escapeHtml(session.ipMasked)}</span>
          <small>${formatDate(session.lastSeenAt)} · ${formatDuration(session.durationMs)}</small>
        </article>
      `
    )
    .join("");
}

function renderFunnel(metrics) {
  const root = document.querySelector("[data-funnel]");
  if (!root) return;
  const kpi = metrics.kpis;
  const rows = [
    ["Visitatori", kpi.visitors],
    ["Checkout avviati", kpi.checkoutStarts],
    ["Ordini", kpi.orders],
    ["Abbandonati", kpi.abandonedCheckouts],
  ];
  root.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="funnel-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderTopProducts(products) {
  const root = document.querySelector("[data-top-products]");
  if (!root) return;
  if (!products || products.length === 0) {
    root.innerHTML = emptyState("Nessun prodotto venduto.");
    return;
  }
  root.innerHTML = products
    .map(
      (product) => `
        <article class="product-row-admin">
          <strong>${escapeHtml(product.name)}</strong>
          <span>${escapeHtml(product.quantity)} venduti · ${formatMoney(product.revenue)}</span>
        </article>
      `
    )
    .join("");
}

function renderSegments(segments) {
  const root = document.querySelector("[data-segments]");
  if (!root) return;
  root.innerHTML = Object.entries(segments || {})
    .map(
      ([label, value]) => `
        <p><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value)}</p>
      `
    )
    .join("");
}

function renderOrders(orders) {
  if (!ordersTable) return;
  if (!orders || orders.length === 0) {
    ordersTable.innerHTML = `<tr><td colspan="8">Nessun ordine ancora.</td></tr>`;
    return;
  }
  ordersTable.innerHTML = orders
    .map((order) => {
      const products =
        (order.products || [])
          .map((product) => [product.name, product.size ? `taglia ${product.size}` : ""].filter(Boolean).join(" - "))
          .join(", ") || "-";
      const customer = [order.customer?.name, order.customer?.email, order.customer?.phone]
        .filter(Boolean)
        .map(escapeHtml)
        .join("<br>");
      const orderDevice = deviceLine({
        ...(order.userAgent || {}),
        screen: order.deviceInfo?.screen,
      });
      return `
        <tr>
          <td>${escapeHtml(order.orderCode)}</td>
          <td>${customer || "-"}</td>
          <td>${escapeHtml(products)}</td>
          <td>${escapeHtml(order.paymentMethod)}</td>
          <td>${escapeHtml(orderDevice)}</td>
          <td>${escapeHtml(order.total || formatMoney(order.totalValue))}</td>
          <td>${escapeHtml(order.status)}</td>
          <td>${formatDate(order.createdAt)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderUsers(users) {
  if (!usersTable) return;
  if (!users || users.length === 0) {
    usersTable.innerHTML = `<tr><td colspan="6">Nessun utente registrato.</td></tr>`;
    return;
  }
  usersTable.innerHTML = users
    .map(
      (user) => `
        <tr>
          <td>${escapeHtml(user.name)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${escapeHtml(user.phone)}</td>
          <td>${escapeHtml((user.providers || [user.provider]).join(", "))}</td>
          <td>${formatDate(user.createdAt)}</td>
          <td>${formatDate(user.lastLoginAt)}</td>
        </tr>
      `
    )
    .join("");
}

function renderActivity(events) {
  const root = document.querySelector("[data-activity-list]");
  if (!root) return;
  if (!events || events.length === 0) {
    root.innerHTML = emptyState("Nessuna attivita recente.");
    return;
  }
  root.innerHTML = events
    .map(
      (event) => `
        <article class="activity-row">
          <span>${formatDate(event.at)}</span>
          <strong>${escapeHtml(event.type)}</strong>
          <p>${escapeHtml(event.path)}${event.product ? ` · ${escapeHtml(event.product)}` : ""}${event.method ? ` · ${escapeHtml(event.method)}` : ""}</p>
        </article>
      `
    )
    .join("");
}

function replayEventLabel(event) {
  const labels = {
    page: "Pagina aperta",
    move: "Movimento mouse",
    click: "Click",
    scroll: "Scroll",
    resize: "Resize",
    input: "Campo modificato",
    checkout: "Checkout",
    order: "Ordine",
  };
  const detail = [event.target, event.text, event.field ? `campo ${event.field}` : ""].filter(Boolean).join(" · ");
  return `${labels[event.type] || event.type}${detail ? ` · ${detail}` : ""}`;
}

function clearReplayTimers() {
  replayTimers.forEach((timer) => window.clearTimeout(timer));
  replayTimers = [];
}

function renderReplaySessions(sessions) {
  if (!replaySessionsRoot) return;
  if (!sessions || sessions.length === 0) {
    replaySessionsRoot.innerHTML = `
      <div class="replay-help">
        <strong>Nessun video registrato ancora.</strong>
        <p>Per vedere un video: apri il sito in una nuova scheda, premi "Accetta tutto" nel banner cookie, naviga/clicca qualche prodotto per almeno 10 secondi, poi torna qui e premi Aggiorna.</p>
      </div>
    `;
    return;
  }
  replaySessionsRoot.innerHTML = sessions
    .map(
      (session) => `
        <article class="replay-session">
          <div>
            <strong>${escapeHtml(session.path || "/")}</strong>
            <span>${escapeHtml(deviceLine(session))} · IP ${escapeHtml(session.ipMasked)} · ${escapeHtml(session.events)} eventi</span>
            <span>${formatDate(session.replayLastAt || session.lastSeenAt)} · ${formatDuration(session.durationMs)}</span>
          </div>
          <button type="button" data-replay-session="${escapeHtml(session.id)}">Guarda video</button>
        </article>
      `
    )
    .join("");
}

function eventPosition(event, screen) {
  const sourceWidth = Number(event.w || window.innerWidth || 1);
  const sourceHeight = Number(event.h || window.innerHeight || 1);
  return {
    x: Math.max(0, Math.min(screen.clientWidth, (Number(event.x || 0) / sourceWidth) * screen.clientWidth)),
    y: Math.max(0, Math.min(screen.clientHeight, (Number(event.y || 0) / sourceHeight) * screen.clientHeight)),
  };
}

function replaySource(path) {
  try {
    const safePath = String(path || "/").startsWith("/") && !String(path || "").startsWith("//") ? String(path || "/") : "/";
    const url = new URL(safePath, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname.includes("admin")) return "/index.html?replay_view=1";
    url.searchParams.set("replay_view", "1");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/index.html?replay_view=1";
  }
}

function scrollReplayFrame(frame, scrollY) {
  try {
    frame?.contentWindow?.scrollTo({ top: Number(scrollY || 0), left: 0, behavior: "auto" });
  } catch {
    // Same-origin in normal use; if blocked, the cursor replay still works.
  }
}

function playReplay(events) {
  clearReplayTimers();
  const screen = replayPlayer?.querySelector("[data-replay-screen]");
  const frame = replayPlayer?.querySelector("[data-replay-frame]");
  const cursor = replayPlayer?.querySelector("[data-replay-cursor]");
  const ring = replayPlayer?.querySelector("[data-replay-click]");
  const progress = replayPlayer?.querySelector("[data-replay-progress]");
  const current = replayPlayer?.querySelector("[data-replay-current]");
  const rows = Array.from(replayPlayer?.querySelectorAll("[data-replay-event-row]") || []);
  if (!screen || !cursor || !progress || events.length === 0) return;

  const maxTime = Math.max(...events.map((event) => Number(event.t || 0)), 1);
  progress.style.setProperty("--progress", "0%");
  rows.forEach((row) => row.classList.remove("is-active"));
  events.forEach((event, index) => {
    const delay = Math.min(16000, Math.round((Number(event.t || 0) / maxTime) * 16000));
    replayTimers.push(
      window.setTimeout(() => {
        rows.forEach((row) => row.classList.remove("is-active"));
        rows[index]?.classList.add("is-active");
        progress.style.setProperty("--progress", `${Math.round(((index + 1) / events.length) * 100)}%`);
        if (current) current.textContent = replayEventLabel(event);
        screen.dataset.page = `${event.path || ""} · ${replayEventLabel(event)}`.slice(0, 120);
        if (event.type === "page") {
          scrollReplayFrame(frame, event.scrollY || 0);
        }
        if (event.type === "move" || event.type === "click") {
          const position = eventPosition(event, screen);
          cursor.style.left = `${position.x}px`;
          cursor.style.top = `${position.y}px`;
          if (event.type === "click" && ring) {
            ring.style.left = `${position.x}px`;
            ring.style.top = `${position.y}px`;
            ring.classList.remove("is-active");
            void ring.offsetWidth;
            ring.classList.add("is-active");
          }
        }
        if (event.type === "scroll") {
          screen.dataset.page = `${event.path || ""} · scroll ${Math.round(Number(event.depth || 0))}%`;
          scrollReplayFrame(frame, event.scrollY || 0);
        }
      }, delay)
    );
  });
}

function renderReplayPlayer(replay) {
  if (!replayPlayer) return;
  clearReplayTimers();
  const events = Array.isArray(replay.events) ? replay.events : [];
  if (events.length === 0) {
    replayPlayer.innerHTML = emptyState("Replay vuoto.");
    return;
  }
  const firstPath = events.find((event) => event.path)?.path || replay.path || "/";
  replayPlayer.innerHTML = `
    <div class="replay-meta">
      <span>${escapeHtml(replay.path || "/")}</span>
      <span>${escapeHtml(deviceLine(replay))}</span>
      <span>IP ${escapeHtml(replay.ipMasked)}</span>
      <span>${escapeHtml(events.length)} eventi</span>
    </div>
    <div class="replay-controls">
      <button type="button" data-replay-play>Riproduci video</button>
      <div class="replay-progress" data-replay-progress><i></i></div>
    </div>
    <div class="replay-screen" data-replay-screen data-page="${escapeHtml(firstPath)}">
      <iframe class="replay-frame" data-replay-frame src="${escapeHtml(replaySource(firstPath))}" title="Pagina visitata dall'utente" tabindex="-1"></iframe>
      <div class="replay-frame-shade"></div>
      <strong class="replay-current" data-replay-current>Pronto per riprodurre</strong>
      <span class="replay-cursor" data-replay-cursor style="left: 50%; top: 50%;"></span>
      <span class="replay-click-ring" data-replay-click></span>
    </div>
    <div class="replay-event-log">
      ${events
        .map(
          (event, index) => `
            <p data-replay-event-row="${index}">
              <strong>${formatDuration(event.t)}</strong> · ${escapeHtml(replayEventLabel(event))}
            </p>
          `
        )
        .join("")}
    </div>
  `;
  replayPlayer.querySelector("[data-replay-play]")?.addEventListener("click", () => playReplay(events));
  window.setTimeout(() => playReplay(events), 350);
}

async function loadReplay(sessionId) {
  if (!replayPlayer) return;
  replayPlayer.innerHTML = emptyState("Carico replay...");
  try {
    const data = await api(`/api/admin/replay?sessionId=${encodeURIComponent(sessionId)}`);
    renderReplayPlayer(data.replay);
  } catch (error) {
    replayPlayer.innerHTML = emptyState(error.message);
  }
}

function renderDashboard(metrics) {
  adminTotal.textContent = `${metrics.kpis.liveVisitors} live`;
  renderMetrics(metrics);
  renderLiveSessions(metrics.liveSessions);
  renderFunnel(metrics);
  renderTopProducts(metrics.topProducts);
  renderSegments(metrics.segments);
  renderOrders(metrics.recentOrders);
  renderActivity(metrics.recentEvents);
  renderReplaySessions(metrics.replaySessions);
  renderChart("[data-devices]", metrics.devices);
  renderChart("[data-device-models]", metrics.deviceModels);
  renderChart("[data-browsers]", metrics.browsers);
  renderChart("[data-os-versions]", metrics.osVersions);
  renderChart("[data-pages]", metrics.pages);
  renderChart("[data-referrers]", metrics.referrers);
  renderChart("[data-payments]", metrics.payments);
  renderChart("[data-os]", metrics.os);
}

async function loadDashboard() {
  const [usersData, metricsData] = await Promise.all([
    api("/api/admin/users"),
    api("/api/admin/metrics"),
  ]);
  adminLogin.hidden = true;
  adminPanel.hidden = false;
  renderUsers(usersData.users);
  renderDashboard(metricsData.metrics);
}

adminLogin?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAdminMessage("Accesso in corso...");
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(adminLogin))),
    });
    setAdminMessage("");
    await loadDashboard();
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
});

document.querySelector("[data-admin-refresh]")?.addEventListener("click", loadDashboard);

document.addEventListener("click", (event) => {
  const replayButton = event.target.closest("[data-replay-session]");
  if (replayButton) {
    loadReplay(replayButton.dataset.replaySession);
  }
});

document.querySelectorAll("[data-admin-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const selected = tab.dataset.adminTab;
    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
      button.classList.toggle("is-active", button === tab);
    });
    document.querySelectorAll("[data-admin-panel-tab]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.adminPanelTab === selected);
    });
  });
});

loadDashboard().catch(() => {});

if (window.lucide) {
  window.lucide.createIcons();
}
