const TOKEN_KEY = "vcc_gpt_token";
const GUEST_KEY = "vcc_gpt_guest_id";

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  guestId: getOrCreateGuestId(),
  user: null,
  guest: null
};

const el = {
  sessionRole: document.getElementById("sessionRole"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginPanel: document.getElementById("loginPanel"),
  loginForm: document.getElementById("loginForm"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  creditValue: document.getElementById("creditValue"),
  dailyCreditValue: document.getElementById("dailyCreditValue"),
  generateBtn: document.getElementById("generateBtn"),
  generateMessage: document.getElementById("generateMessage"),
  vccCard: document.getElementById("vccCard"),
  cardNumber: document.getElementById("cardNumber"),
  cardHolder: document.getElementById("cardHolder"),
  cardExpiry: document.getElementById("cardExpiry"),
  cardCvv: document.getElementById("cardCvv"),
  historyList: document.getElementById("historyList"),
  topupLink: document.getElementById("topupLink"),
  adminPanel: document.getElementById("adminPanel"),
  vccForm: document.getElementById("vccForm"),
  vccInput: document.getElementById("vccInput"),
  vccFileInput: document.getElementById("vccFileInput"),
  vccBatchInfo: document.getElementById("vccBatchInfo"),
  vccResult: document.getElementById("vccResult"),
  vccTableBody: document.getElementById("vccTableBody"),
  addUserForm: document.getElementById("addUserForm"),
  newUsername: document.getElementById("newUsername"),
  newPassword: document.getElementById("newPassword"),
  newRole: document.getElementById("newRole"),
  newCredit: document.getElementById("newCredit"),
  userResult: document.getElementById("userResult"),
  userListState: document.getElementById("userListState"),
  userTableBody: document.getElementById("userTableBody")
};

function getOrCreateGuestId() {
  const existing = localStorage.getItem(GUEST_KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(GUEST_KEY, id);
  return id;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isAdmin() {
  return state.user?.role === "admin";
}

function formatCardNumber(number) {
  return String(number || "").replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
}

function formatDateTime(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("id-ID");
}

function splitBatchLines(text) {
  return String(text || "")
    .replace(/[;,]+/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function refreshBatchInfo() {
  const count = splitBatchLines(el.vccInput.value).length;
  el.vccBatchInfo.textContent = `Batch lines: ${count}`;
}

function showMessage(target, message, isError = false) {
  target.textContent = message || "";
  target.style.color = isError ? "var(--danger)" : "var(--ink-soft)";
}

function resetCardTransform() {
  el.vccCard?.style.setProperty("--rx", "0deg");
  el.vccCard?.style.setProperty("--ry", "0deg");
  el.vccCard?.style.setProperty("--px", "50%");
  el.vccCard?.style.setProperty("--py", "50%");
}

function initializeCardMotion() {
  if (!el.vccCard) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const maxTilt = 8;
  let frameRequested = false;
  let pending = null;

  const applyTilt = () => {
    frameRequested = false;
    if (!pending) return;

    const { clientX, clientY, rect } = pending;
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * maxTilt;
    const ry = (px - 0.5) * maxTilt;

    el.vccCard.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    el.vccCard.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    el.vccCard.style.setProperty("--px", `${(px * 100).toFixed(2)}%`);
    el.vccCard.style.setProperty("--py", `${(py * 100).toFixed(2)}%`);
  };

  el.vccCard.addEventListener("pointermove", (event) => {
    const rect = el.vccCard.getBoundingClientRect();
    pending = { clientX: event.clientX, clientY: event.clientY, rect };
    if (!frameRequested) {
      frameRequested = true;
      window.requestAnimationFrame(applyTilt);
    }
  });

  el.vccCard.addEventListener("pointerleave", () => {
    pending = null;
    resetCardTransform();
  });
}

function pulseCardHit() {
  if (!el.vccCard) return;
  el.vccCard.classList.remove("is-hit");
  window.requestAnimationFrame(() => {
    el.vccCard.classList.add("is-hit");
    window.setTimeout(() => el.vccCard?.classList.remove("is-hit"), 700);
  });
}

async function api(path, { method = "GET", body = null, auth = true } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (auth && state.token) headers.authorization = `Bearer ${state.token}`;

  const response = await fetch(`/api/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = { ok: false, message: "Invalid server response" };
  }

  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function renderSession() {
  if (state.user) {
    el.sessionRole.textContent = `Role: ${state.user.role.toUpperCase()} (${state.user.username})`;
    el.creditValue.textContent = state.user.creditsLabel;
    el.dailyCreditValue.textContent =
      state.user.role === "admin" ? "Unlimited" : `${state.user.dailyCredit} / day`;
    el.loginPanel.classList.add("hidden");
    el.logoutBtn.classList.remove("hidden");
    if (state.user.role === "admin") {
      el.adminPanel.classList.remove("hidden");
      el.topupLink.classList.add("hidden");
    } else {
      el.adminPanel.classList.add("hidden");
      el.topupLink.classList.remove("hidden");
    }
  } else {
    const guestCredit = Number(state.guest?.credits || 0);
    el.sessionRole.textContent = "Role: GUEST";
    el.creditValue.textContent = String(guestCredit);
    el.dailyCreditValue.textContent = "1 / day";
    el.loginPanel.classList.remove("hidden");
    el.logoutBtn.classList.add("hidden");
    el.adminPanel.classList.add("hidden");
    el.topupLink.classList.remove("hidden");
  }

  if (el.cardHolder) {
    const holderRaw = state.user?.username || "GUEST USER";
    el.cardHolder.textContent = holderRaw.toUpperCase().slice(0, 18);
  }

  const currentCredit = state.user
    ? state.user.role === "admin"
      ? Infinity
      : Number(state.user.credits || 0)
    : Number(state.guest?.credits || 0);
  el.generateBtn.disabled = currentCredit < 1;
}

function renderCard(generated) {
  if (!generated) {
    el.cardNumber.textContent = "**** **** **** ****";
    el.cardExpiry.textContent = "MM/YYYY";
    el.cardCvv.textContent = "***";
    return;
  }
  el.cardNumber.textContent = formatCardNumber(generated.number);
  el.cardExpiry.textContent = `${generated.month}/${generated.year}`;
  el.cardCvv.textContent = generated.cvv;
}

function renderHistory(items) {
  if (!items || items.length === 0) {
    el.historyList.innerHTML = "<li>Belum ada VCC used.</li>";
    return;
  }

  el.historyList.innerHTML = items
    .map((item) => {
      const actor = isAdmin() ? `<span>${escapeHtml(item.actorLabel || "-")}</span>` : "";
      return `<li>
        <strong>${escapeHtml(item.maskedNumber)}</strong> | ${escapeHtml(item.month)}/${escapeHtml(item.year)}
        <div class="history-meta">
          <span>${formatDateTime(item.usedAt)}</span>
          ${actor}
        </div>
        <div class="status-ok">${escapeHtml(item.status || "Live Hit Success ✅")}</div>
      </li>`;
    })
    .join("");
}

function renderVccTable(items) {
  if (!items || items.length === 0) {
    el.vccTableBody.innerHTML = "<tr><td colspan='5'>Belum ada data VCC.</td></tr>";
    return;
  }

  el.vccTableBody.innerHTML = items
    .map((item) => {
      const status = item.used ? "used ✅" : "available";
      const action = item.used
        ? "-"
        : `<button class="btn btn-soft" data-action="delete-vcc" data-id="${escapeHtml(item.id)}" type="button">Delete</button>`;
      return `<tr>
        <td>${escapeHtml(item.number)}</td>
        <td>${escapeHtml(item.month)}/${escapeHtml(item.year)}</td>
        <td>${escapeHtml(item.cvv)}</td>
        <td>${status}</td>
        <td>${action}</td>
      </tr>`;
    })
    .join("");
}

function renderUserTable(items) {
  if (!items || items.length === 0) {
    el.userTableBody.innerHTML = "<tr><td colspan='4'>Belum ada user.</td></tr>";
    return;
  }

  el.userTableBody.innerHTML = items
    .map((user) => {
      const topupArea =
        user.role === "admin"
          ? "Unlimited"
          : `<div class="row-actions">
              <input type="number" min="1" value="1" data-credit-input="${escapeHtml(user.id)}" />
              <button class="btn btn-soft" type="button" data-action="add-credit" data-id="${escapeHtml(user.id)}">Add</button>
            </div>`;

      return `<tr>
        <td>${escapeHtml(user.username)}</td>
        <td>${escapeHtml(user.role)}</td>
        <td>${escapeHtml(user.creditsLabel)}</td>
        <td>${topupArea}</td>
      </tr>`;
    })
    .join("");
}

function clearToken() {
  state.token = "";
  localStorage.removeItem(TOKEN_KEY);
}

async function refreshSession() {
  const data = await api(`session?guestId=${encodeURIComponent(state.guestId)}`, { auth: true });
  if (data.authenticated && data.user) {
    state.user = data.user;
    state.guest = null;
  } else {
    if (state.token) clearToken();
    state.user = null;
    state.guest = data.guest || { credits: 0 };
  }
  renderSession();
}

async function loadHistory() {
  try {
    let endpoint = `history?guestId=${encodeURIComponent(state.guestId)}`;
    if (state.user) endpoint = state.user.role === "admin" ? "history?all=1" : "history";
    const data = await api(endpoint, { auth: true });
    renderHistory(data.items || []);
  } catch (error) {
    renderHistory([]);
    showMessage(el.generateMessage, error.message, true);
  }
}

async function loadVccPool() {
  if (!isAdmin()) return;
  try {
    const data = await api("admin-vcc");
    renderVccTable(data.items || []);
  } catch (error) {
    showMessage(el.vccResult, error.message, true);
  }
}

async function loadUsers() {
  if (!isAdmin()) return;
  el.userListState.textContent = "Loading users...";
  el.userListState.classList.remove("hidden");
  try {
    const data = await api("admin-users");
    renderUserTable(data.items || []);
    if ((data.items || []).length === 0) {
      el.userListState.textContent = "Belum ada user tambahan.";
      el.userListState.classList.remove("hidden");
    } else {
      el.userListState.textContent = "";
      el.userListState.classList.add("hidden");
    }
  } catch (error) {
    el.userListState.textContent = `Gagal load users: ${error.message}`;
    el.userListState.classList.remove("hidden");
  }
}

async function handleGenerate() {
  el.generateBtn.disabled = true;
  el.vccCard?.classList.add("is-generating");
  showMessage(el.generateMessage, "Generating...");
  try {
    const data = await api("generate", {
      method: "POST",
      body: { guestId: state.guestId },
      auth: true
    });
    renderCard(data.generated);
    pulseCardHit();
    showMessage(el.generateMessage, `Success. Sisa credit: ${data.remainingCredits}`);
    await refreshSession();
    await loadHistory();
    if (isAdmin()) await loadVccPool();
  } catch (error) {
    showMessage(el.generateMessage, error.message, true);
  } finally {
    el.vccCard?.classList.remove("is-generating");
    renderSession();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const username = el.usernameInput.value.trim();
  const password = el.passwordInput.value.trim();
  if (!username || !password) return;
  showMessage(el.generateMessage, "Login process...");
  try {
    const data = await api("auth-login", {
      method: "POST",
      body: { username, password },
      auth: false
    });
    state.token = data.token;
    localStorage.setItem(TOKEN_KEY, state.token);
    await refreshSession();
    await loadHistory();
    if (isAdmin()) {
      await loadUsers();
      await loadVccPool();
    }
    el.loginForm.reset();
    showMessage(el.generateMessage, `Login sukses sebagai ${data.user.username}`);
  } catch (error) {
    showMessage(el.generateMessage, error.message, true);
  }
}

async function handleLogout() {
  clearToken();
  state.user = null;
  await refreshSession();
  await loadHistory();
  renderCard(null);
}

async function handleVccSubmit(event) {
  event.preventDefault();
  const lines = el.vccInput.value.trim();
  if (!lines) return;
  showMessage(el.vccResult, "Saving VCC list...");
  try {
    const data = await api("admin-vcc", {
      method: "POST",
      body: { lines }
    });
    showMessage(
      el.vccResult,
      `Added: ${data.added}, Duplicate: ${data.duplicates}, Invalid: ${data.invalid}`
    );
    el.vccForm.reset();
    refreshBatchInfo();
    await loadVccPool();
  } catch (error) {
    showMessage(el.vccResult, error.message, true);
  }
}

async function handleVccFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const joined = [el.vccInput.value.trim(), text.trim()].filter(Boolean).join("\n");
    el.vccInput.value = joined;
    refreshBatchInfo();
    showMessage(el.vccResult, `File loaded: ${file.name}`);
  } catch {
    showMessage(el.vccResult, "Gagal membaca file batch.", true);
  } finally {
    el.vccFileInput.value = "";
  }
}

async function handleAddUser(event) {
  event.preventDefault();
  const username = el.newUsername.value.trim();
  const password = el.newPassword.value.trim();
  const role = el.newRole.value;
  const initialCredits = Number(el.newCredit.value || 0);

  showMessage(el.userResult, "Creating user...");
  try {
    await api("admin-users", {
      method: "POST",
      body: { username, password, role, initialCredits }
    });
    showMessage(el.userResult, "User berhasil ditambahkan.");
    el.addUserForm.reset();
    el.newRole.value = "free";
    el.newCredit.value = "0";
    await loadUsers();
  } catch (error) {
    showMessage(el.userResult, error.message, true);
  }
}

async function handleUserTableClick(event) {
  const button = event.target.closest("button[data-action='add-credit']");
  if (!button) return;
  const userId = button.dataset.id;
  const input = Array.from(el.userTableBody.querySelectorAll("input[data-credit-input]")).find(
    (item) => item.dataset.creditInput === userId
  );
  const delta = Number(input?.value || 0);
  if (!Number.isFinite(delta) || delta < 1) {
    showMessage(el.userResult, "Credit minimal 1", true);
    return;
  }

  button.disabled = true;
  try {
    await api("admin-users", {
      method: "PATCH",
      body: { userId, creditDelta: Math.trunc(delta) }
    });
    showMessage(el.userResult, `Credit user berhasil ditambah +${Math.trunc(delta)}`);
    await loadUsers();
  } catch (error) {
    showMessage(el.userResult, error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function handleVccTableClick(event) {
  const button = event.target.closest("button[data-action='delete-vcc']");
  if (!button) return;
  const vccId = button.dataset.id;
  button.disabled = true;
  try {
    await api("admin-vcc", {
      method: "DELETE",
      body: { vccId }
    });
    await loadVccPool();
  } catch (error) {
    showMessage(el.vccResult, error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function init() {
  renderCard(null);
  resetCardTransform();
  initializeCardMotion();
  try {
    await refreshSession();
    await loadHistory();
    if (isAdmin()) {
      await loadUsers();
      await loadVccPool();
    }
  } catch (error) {
    showMessage(el.generateMessage, error.message, true);
  }
}

el.generateBtn.addEventListener("click", handleGenerate);
el.loginForm.addEventListener("submit", handleLogin);
el.logoutBtn.addEventListener("click", handleLogout);
el.vccForm.addEventListener("submit", handleVccSubmit);
el.vccInput.addEventListener("input", refreshBatchInfo);
el.vccFileInput.addEventListener("change", handleVccFileChange);
el.addUserForm.addEventListener("submit", handleAddUser);
el.userTableBody.addEventListener("click", handleUserTableClick);
el.vccTableBody.addEventListener("click", handleVccTableClick);

init();
refreshBatchInfo();
