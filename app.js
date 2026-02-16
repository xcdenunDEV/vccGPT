const TOKEN_KEY = "vcc_gpt_token";
const GUEST_KEY = "vcc_gpt_guest_id";
const PAGE_MODE = document.body?.dataset?.page || "home";

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  guestId: getOrCreateGuestId(),
  user: null,
  guest: null,
  vccItems: [],
  userItems: [],
  generatedCard: null,
  vccPage: 1,
  userPage: 1,
  vccPageSize: 10,
  userPageSize: 10
};

const el = {
  sessionRole: document.getElementById("sessionRole"),
  adminNavLink: document.getElementById("adminNavLink"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginPanel: document.getElementById("loginPanel"),
  loginForm: document.getElementById("loginForm"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  creditValue: document.getElementById("creditValue"),
  dailyCreditValue: document.getElementById("dailyCreditValue"),
  generateBtn: document.getElementById("generateBtn"),
  generateMessage: document.getElementById("generateMessage"),
  adminMessage: document.getElementById("adminMessage"),
  adminNoticeText: document.getElementById("adminNoticeText"),
  vccCard: document.getElementById("vccCard"),
  cardNumber: document.getElementById("cardNumber"),
  cardHolder: document.getElementById("cardHolder"),
  cardExpiry: document.getElementById("cardExpiry"),
  cardCvv: document.getElementById("cardCvv"),
  copyPanel: document.getElementById("copyPanel"),
  copyCardNumberValue: document.getElementById("copyCardNumberValue"),
  copyExpiryValue: document.getElementById("copyExpiryValue"),
  copyMonthValue: document.getElementById("copyMonthValue"),
  copyYearValue: document.getElementById("copyYearValue"),
  copyCvvValue: document.getElementById("copyCvvValue"),
  historyList: document.getElementById("historyList"),
  topupLink: document.getElementById("topupLink"),
  adminPanel: document.getElementById("adminPanel"),
  vccForm: document.getElementById("vccForm"),
  vccInput: document.getElementById("vccInput"),
  vccFileInput: document.getElementById("vccFileInput"),
  vccBatchInfo: document.getElementById("vccBatchInfo"),
  vccResult: document.getElementById("vccResult"),
  vccTableBody: document.getElementById("vccTableBody"),
  vccPagination: document.getElementById("vccPagination"),
  addUserForm: document.getElementById("addUserForm"),
  newUsername: document.getElementById("newUsername"),
  newPassword: document.getElementById("newPassword"),
  newRole: document.getElementById("newRole"),
  newCredit: document.getElementById("newCredit"),
  userResult: document.getElementById("userResult"),
  userListState: document.getElementById("userListState"),
  userTableBody: document.getElementById("userTableBody"),
  userPagination: document.getElementById("userPagination")
};

function getPrimaryMessageTarget() {
  return PAGE_MODE === "admin" ? el.adminMessage : el.generateMessage;
}

function setHidden(element, hidden) {
  if (!element) return;
  element.classList.toggle("hidden", hidden);
}

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
    .replace(/\"/g, "&quot;")
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
  if (!el.vccInput || !el.vccBatchInfo) return;
  const count = splitBatchLines(el.vccInput.value).length;
  el.vccBatchInfo.textContent = `Batch lines: ${count}`;
}

function showMessage(target, message, isError = false) {
  if (!target) return;
  target.textContent = message || "";
  target.style.color = isError ? "var(--danger)" : "var(--ink-soft)";
}

function resetCardTransform() {
  if (!el.vccCard) return;
  el.vccCard.style.setProperty("--rx", "0deg");
  el.vccCard.style.setProperty("--ry", "0deg");
  el.vccCard.style.setProperty("--px", "50%");
  el.vccCard.style.setProperty("--py", "50%");
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

function getTotalPages(totalItems, pageSize) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

function getPageSlice(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function renderPagination(container, kind, page, totalPages, totalItems) {
  if (!container) return;
  if (totalItems <= 0) {
    container.innerHTML = "";
    return;
  }

  const prevDisabled = page <= 1 ? "disabled" : "";
  const nextDisabled = page >= totalPages ? "disabled" : "";

  container.innerHTML = `
    <div class="pagination-meta">Total ${totalItems} data</div>
    <div class="pagination-actions">
      <button type="button" class="btn btn-soft btn-page" data-pagination-kind="${kind}" data-pagination-action="first" ${prevDisabled}>First</button>
      <button type="button" class="btn btn-soft btn-page" data-pagination-kind="${kind}" data-pagination-action="prev" ${prevDisabled}>Prev</button>
      <span class="pagination-info">Page ${page} / ${totalPages}</span>
      <button type="button" class="btn btn-soft btn-page" data-pagination-kind="${kind}" data-pagination-action="next" ${nextDisabled}>Next</button>
      <button type="button" class="btn btn-soft btn-page" data-pagination-kind="${kind}" data-pagination-action="last" ${nextDisabled}>Last</button>
    </div>
  `;
}

function renderSession() {
  if (el.sessionRole) {
    if (state.user) {
      el.sessionRole.textContent = `Role: ${state.user.role.toUpperCase()} (${state.user.username})`;
    } else {
      el.sessionRole.textContent = "Role: GUEST";
    }
  }

  if (el.cardHolder) {
    const holderRaw = state.user?.username || "GUEST USER";
    el.cardHolder.textContent = holderRaw.toUpperCase().slice(0, 18);
  }

  if (PAGE_MODE === "home") {
    if (el.creditValue) {
      el.creditValue.textContent = state.user
        ? state.user.creditsLabel
        : String(Number(state.guest?.credits || 0));
    }
    if (el.dailyCreditValue) {
      el.dailyCreditValue.textContent = state.user
        ? state.user.role === "admin"
          ? "Unlimited"
          : `${state.user.dailyCredit} / day`
        : "1 / day";
    }

    setHidden(el.loginPanel, Boolean(state.user));
    setHidden(el.logoutBtn, !state.user);
    setHidden(el.adminNavLink, !isAdmin());
    if (el.topupLink) setHidden(el.topupLink, isAdmin());

    const currentCredit = state.user
      ? state.user.role === "admin"
        ? Infinity
        : Number(state.user.credits || 0)
      : Number(state.guest?.credits || 0);
    if (el.generateBtn) el.generateBtn.disabled = currentCredit < 1;
  }

  if (PAGE_MODE === "admin") {
    setHidden(el.logoutBtn, !state.user);

    if (isAdmin()) {
      setHidden(el.loginPanel, true);
      setHidden(el.adminPanel, false);
      if (el.adminNoticeText) {
        el.adminNoticeText.textContent = "Anda login sebagai admin. Kelola data VCC dan user dari halaman ini.";
      }
    } else {
      setHidden(el.loginPanel, false);
      setHidden(el.adminPanel, true);
      if (el.adminNoticeText) {
        el.adminNoticeText.textContent = state.user
          ? "Akun ini bukan admin. Silakan login dengan akun admin atau kembali ke halaman Home."
          : "Login sebagai admin untuk mengelola data VCC dan user.";
      }
    }
  }
}

function renderCard(generated) {
  if (!el.cardNumber || !el.cardExpiry || !el.cardCvv) return;
  if (!generated) {
    state.generatedCard = null;
    el.cardNumber.textContent = "**** **** **** ****";
    el.cardExpiry.textContent = "MM/YYYY";
    el.cardCvv.textContent = "***";
    renderCopyFields();
    return;
  }
  state.generatedCard = {
    number: String(generated.number || ""),
    month: String(generated.month || ""),
    year: String(generated.year || ""),
    cvv: String(generated.cvv || "")
  };
  el.cardNumber.textContent = formatCardNumber(generated.number);
  el.cardExpiry.textContent = `${generated.month}/${generated.year}`;
  el.cardCvv.textContent = generated.cvv;
  renderCopyFields();
}

function renderCopyFields() {
  if (!el.copyPanel) return;
  const card = state.generatedCard;

  const numberValue = card?.number || "-";
  const monthValue = card?.month || "-";
  const yearValue = card?.year || "-";
  const cvvValue = card?.cvv || "-";
  const expiryValue = card ? `${monthValue}/${yearValue}` : "-";

  if (el.copyCardNumberValue) el.copyCardNumberValue.textContent = numberValue;
  if (el.copyExpiryValue) el.copyExpiryValue.textContent = expiryValue;
  if (el.copyMonthValue) el.copyMonthValue.textContent = monthValue;
  if (el.copyYearValue) el.copyYearValue.textContent = yearValue;
  if (el.copyCvvValue) el.copyCvvValue.textContent = cvvValue;
}

function getCopyTextByField(field) {
  if (!state.generatedCard) return "";
  if (field === "number") return state.generatedCard.number;
  if (field === "month") return state.generatedCard.month;
  if (field === "year") return state.generatedCard.year;
  if (field === "cvv") return state.generatedCard.cvv;
  if (field === "expiry") return `${state.generatedCard.month}/${state.generatedCard.year}`;
  return "";
}

async function copyToClipboard(text) {
  if (!text) return false;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(input);
  return copied;
}

async function handleCopyPanelClick(event) {
  const button = event.target.closest("button[data-copy-field]");
  if (!button) return;

  const field = button.dataset.copyField;
  const text = getCopyTextByField(field);
  if (!text) {
    showMessage(el.generateMessage, "Generate dulu agar data bisa dicopy.", true);
    return;
  }

  button.disabled = true;
  try {
    await copyToClipboard(text);
    showMessage(el.generateMessage, `${field.toUpperCase()} copied.`);
  } catch {
    showMessage(el.generateMessage, "Gagal copy data.", true);
  } finally {
    button.disabled = false;
  }
}

function renderHistory(items) {
  if (!el.historyList) return;
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

function renderVccTable() {
  if (!el.vccTableBody) return;

  const totalPages = getTotalPages(state.vccItems.length, state.vccPageSize);
  if (state.vccPage > totalPages) state.vccPage = totalPages;
  const pageItems = getPageSlice(state.vccItems, state.vccPage, state.vccPageSize);

  if (pageItems.length === 0) {
    el.vccTableBody.innerHTML = "<tr><td colspan='5'>Belum ada data VCC.</td></tr>";
  } else {
    el.vccTableBody.innerHTML = pageItems
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

  renderPagination(el.vccPagination, "vcc", state.vccPage, totalPages, state.vccItems.length);
}

function renderUserTable() {
  if (!el.userTableBody) return;

  const totalPages = getTotalPages(state.userItems.length, state.userPageSize);
  if (state.userPage > totalPages) state.userPage = totalPages;
  const pageItems = getPageSlice(state.userItems, state.userPage, state.userPageSize);

  if (pageItems.length === 0) {
    el.userTableBody.innerHTML = "<tr><td colspan='4'>Belum ada user.</td></tr>";
  } else {
    el.userTableBody.innerHTML = pageItems
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

  renderPagination(el.userPagination, "user", state.userPage, totalPages, state.userItems.length);
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
  if (!el.historyList) return;
  try {
    let endpoint = `history?guestId=${encodeURIComponent(state.guestId)}`;
    if (state.user) endpoint = state.user.role === "admin" ? "history?all=1" : "history";
    const data = await api(endpoint, { auth: true });
    renderHistory(data.items || []);
  } catch (error) {
    renderHistory([]);
    showMessage(getPrimaryMessageTarget(), error.message, true);
  }
}

async function loadVccPool(resetPage = false) {
  if (!isAdmin() || !el.vccTableBody) return;
  try {
    const data = await api("admin-vcc");
    state.vccItems = data.items || [];
    if (resetPage) state.vccPage = 1;
    renderVccTable();
  } catch (error) {
    showMessage(el.vccResult, error.message, true);
  }
}

async function loadUsers(resetPage = false) {
  if (!isAdmin() || !el.userTableBody) return;
  if (el.userListState) {
    el.userListState.textContent = "Loading users...";
    setHidden(el.userListState, false);
  }

  try {
    const data = await api("admin-users");
    state.userItems = data.items || [];
    if (resetPage) state.userPage = 1;
    renderUserTable();

    if (el.userListState) {
      if (state.userItems.length === 0) {
        el.userListState.textContent = "Belum ada user tambahan.";
        setHidden(el.userListState, false);
      } else {
        el.userListState.textContent = "";
        setHidden(el.userListState, true);
      }
    }
  } catch (error) {
    if (el.userListState) {
      el.userListState.textContent = `Gagal load users: ${error.message}`;
      setHidden(el.userListState, false);
    }
  }
}

async function handleGenerate() {
  if (!el.generateBtn) return;
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
  } catch (error) {
    showMessage(el.generateMessage, error.message, true);
  } finally {
    el.vccCard?.classList.remove("is-generating");
    renderSession();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const username = el.usernameInput?.value?.trim();
  const password = el.passwordInput?.value?.trim();
  if (!username || !password) return;

  const messageTarget = getPrimaryMessageTarget();
  showMessage(messageTarget, "Login process...");

  try {
    const data = await api("auth-login", {
      method: "POST",
      body: { username, password },
      auth: false
    });

    state.token = data.token;
    localStorage.setItem(TOKEN_KEY, state.token);

    await refreshSession();

    if (PAGE_MODE === "home") {
      await loadHistory();
      showMessage(messageTarget, `Login sukses sebagai ${data.user.username}`);
    }

    if (PAGE_MODE === "admin") {
      if (isAdmin()) {
        await loadUsers(true);
        await loadVccPool(true);
        showMessage(messageTarget, `Login admin sukses: ${data.user.username}`);
      } else {
        showMessage(messageTarget, "Akun ini bukan admin. Gunakan akun role admin.", true);
      }
    }

    el.loginForm?.reset();
  } catch (error) {
    showMessage(messageTarget, error.message, true);
  }
}

async function handleLogout() {
  clearToken();
  state.user = null;
  state.userItems = [];
  state.vccItems = [];

  await refreshSession();

  if (PAGE_MODE === "home") {
    await loadHistory();
    renderCard(null);
    showMessage(el.generateMessage, "Anda sudah logout.");
  }

  if (PAGE_MODE === "admin") {
    renderUserTable();
    renderVccTable();
    showMessage(el.adminMessage, "Anda sudah logout.");
  }
}

async function handleVccSubmit(event) {
  event.preventDefault();
  if (!el.vccInput) return;

  const lines = el.vccInput.value.trim();
  if (!lines) return;
  showMessage(el.vccResult, "Saving VCC list...");

  try {
    const data = await api("admin-vcc", {
      method: "POST",
      body: { lines }
    });

    showMessage(el.vccResult, `Added: ${data.added}, Duplicate: ${data.duplicates}, Invalid: ${data.invalid}`);
    el.vccForm?.reset();
    refreshBatchInfo();
    await loadVccPool(true);
  } catch (error) {
    showMessage(el.vccResult, error.message, true);
  }
}

async function handleVccFileChange(event) {
  if (!el.vccInput || !el.vccFileInput) return;

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
  if (!el.newUsername || !el.newPassword || !el.newRole || !el.newCredit) return;

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
    el.addUserForm?.reset();
    el.newRole.value = "free";
    el.newCredit.value = "0";
    await loadUsers(true);
  } catch (error) {
    showMessage(el.userResult, error.message, true);
  }
}

async function handleUserTableClick(event) {
  const button = event.target.closest("button[data-action='add-credit']");
  if (!button || !el.userTableBody) return;

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
    await loadUsers(false);
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
    await loadVccPool(false);
  } catch (error) {
    showMessage(el.vccResult, error.message, true);
  } finally {
    button.disabled = false;
  }
}

function applyPaginationAction(kind, action) {
  if (kind === "vcc") {
    const totalPages = getTotalPages(state.vccItems.length, state.vccPageSize);
    if (action === "first") state.vccPage = 1;
    if (action === "prev") state.vccPage = Math.max(1, state.vccPage - 1);
    if (action === "next") state.vccPage = Math.min(totalPages, state.vccPage + 1);
    if (action === "last") state.vccPage = totalPages;
    renderVccTable();
    return;
  }

  if (kind === "user") {
    const totalPages = getTotalPages(state.userItems.length, state.userPageSize);
    if (action === "first") state.userPage = 1;
    if (action === "prev") state.userPage = Math.max(1, state.userPage - 1);
    if (action === "next") state.userPage = Math.min(totalPages, state.userPage + 1);
    if (action === "last") state.userPage = totalPages;
    renderUserTable();
  }
}

function handlePaginationClick(event) {
  const button = event.target.closest("button[data-pagination-kind][data-pagination-action]");
  if (!button) return;

  const kind = button.dataset.paginationKind;
  const action = button.dataset.paginationAction;
  applyPaginationAction(kind, action);
}

function bindEvents() {
  el.generateBtn?.addEventListener("click", handleGenerate);
  el.loginForm?.addEventListener("submit", handleLogin);
  el.logoutBtn?.addEventListener("click", handleLogout);

  el.vccForm?.addEventListener("submit", handleVccSubmit);
  el.vccInput?.addEventListener("input", refreshBatchInfo);
  el.vccFileInput?.addEventListener("change", handleVccFileChange);
  el.addUserForm?.addEventListener("submit", handleAddUser);
  el.userTableBody?.addEventListener("click", handleUserTableClick);
  el.vccTableBody?.addEventListener("click", handleVccTableClick);
  el.vccPagination?.addEventListener("click", handlePaginationClick);
  el.userPagination?.addEventListener("click", handlePaginationClick);
  el.copyPanel?.addEventListener("click", handleCopyPanelClick);
}

async function init() {
  renderCard(null);
  resetCardTransform();
  initializeCardMotion();
  refreshBatchInfo();

  try {
    await refreshSession();

    if (PAGE_MODE === "home") {
      await loadHistory();
    }

    if (PAGE_MODE === "admin" && isAdmin()) {
      await loadUsers(true);
      await loadVccPool(true);
    }
  } catch (error) {
    showMessage(getPrimaryMessageTarget(), error.message, true);
  }
}

bindEvents();
init();
