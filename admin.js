const adminLogin = document.querySelector("[data-admin-login]");
const adminPanel = document.querySelector("[data-admin-panel]");
const adminMessage = document.querySelector("[data-admin-message]");
const usersTable = document.querySelector("[data-users-table]");
const ordersTable = document.querySelector("[data-orders-table]");
const adminTotal = document.querySelector("[data-admin-total]");
const metricGrid = document.querySelector("[data-metric-grid]");

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
          <span>${escapeHtml(session.device)} · ${escapeHtml(session.browser)} · IP ${escapeHtml(session.ipMasked)}</span>
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
    ordersTable.innerHTML = `<tr><td colspan="7">Nessun ordine ancora.</td></tr>`;
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
      return `
        <tr>
          <td>${escapeHtml(order.orderCode)}</td>
          <td>${customer || "-"}</td>
          <td>${escapeHtml(products)}</td>
          <td>${escapeHtml(order.paymentMethod)}</td>
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

function renderDashboard(metrics) {
  adminTotal.textContent = `${metrics.kpis.liveVisitors} live`;
  renderMetrics(metrics);
  renderLiveSessions(metrics.liveSessions);
  renderFunnel(metrics);
  renderTopProducts(metrics.topProducts);
  renderSegments(metrics.segments);
  renderOrders(metrics.recentOrders);
  renderActivity(metrics.recentEvents);
  renderChart("[data-devices]", metrics.devices);
  renderChart("[data-browsers]", metrics.browsers);
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
