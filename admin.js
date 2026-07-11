const adminLogin = document.querySelector("[data-admin-login]");
const adminPanel = document.querySelector("[data-admin-panel]");
const adminMessage = document.querySelector("[data-admin-message]");
const usersTable = document.querySelector("[data-users-table]");
const adminTotal = document.querySelector("[data-admin-total]");

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

function renderUsers(users) {
  adminTotal.textContent = users.length;
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

async function loadUsers() {
  const data = await api("/api/admin/users");
  adminLogin.hidden = true;
  adminPanel.hidden = false;
  renderUsers(data.users);
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
    await loadUsers();
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
});

document.querySelector("[data-admin-refresh]")?.addEventListener("click", loadUsers);

loadUsers().catch(() => {});

if (window.lucide) {
  window.lucide.createIcons();
}
