const providerSel = document.getElementById("provider");
const keyInput = document.getElementById("key");
const modelInput = document.getElementById("model");
const keyHint = document.getElementById("keyHint");
const saveBtn = document.getElementById("save");
const status = document.getElementById("status");

const customPanel = document.getElementById("customPanel");
const customName = document.getElementById("customName");
const customBaseUrl = document.getElementById("customBaseUrl");
const customType = document.getElementById("customType");
const deleteCustomBtn = document.getElementById("deleteCustom");

const NEW_CUSTOM = "__new_custom__";
const CUSTOM_PREFIX = "custom:";

let providers = [];
// Mirrored so the Save handler can write without awaiting first — an await
// would spend the user gesture that chrome.permissions.request needs.
let state = { keys: {}, models: {}, customProviders: [], legacyKey: "" };
let pendingDelete = null;

function setStatus(msg, kind) {
  status.textContent = msg;
  status.className = kind || "";
}

function findProvider(id) {
  return providers.find((p) => p.id === id);
}

function findCustom(id) {
  return state.customProviders.find((c) => c.id === id);
}

function isCustom(id) {
  return id === NEW_CUSTOM || String(id).startsWith(CUSTOM_PREFIX);
}

function savedKeyFor(id) {
  if (state.keys[id]) return state.keys[id];
  if (id === "anthropic" && state.legacyKey) return state.legacyKey;
  return "";
}

function renderProviderOptions(selectedId) {
  const builtins = providers.filter((p) => !p.custom);
  const customs = providers.filter((p) => p.custom);
  const opt = (p) => `<option value="${p.id}">${p.name}</option>`;
  let html = builtins.map(opt).join("");
  if (customs.length) {
    html += `<optgroup label="Custom">${customs.map(opt).join("")}</optgroup>`;
  }
  html += `<option value="${NEW_CUSTOM}">+ Add custom provider…</option>`;
  providerSel.innerHTML = html;
  providerSel.value = selectedId;
}

function refreshFieldsForProvider(providerId) {
  if (providerId === NEW_CUSTOM) {
    customPanel.classList.remove("hidden");
    deleteCustomBtn.classList.add("hidden");
    customName.value = "";
    customBaseUrl.value = "";
    customType.value = "openai";
    keyHint.textContent = "Whatever key your gateway issues.";
    keyInput.value = "";
    keyInput.placeholder = "paste key here";
    modelInput.value = "";
    modelInput.placeholder = "model id, e.g. gpt-4o-mini";
    return;
  }

  const p = findProvider(providerId);
  if (!p) return;

  if (p.custom) {
    const c = findCustom(providerId) || {};
    customPanel.classList.remove("hidden");
    deleteCustomBtn.classList.remove("hidden");
    customName.value = c.name || "";
    customBaseUrl.value = c.baseUrl || "";
    customType.value = c.type === "anthropic" ? "anthropic" : "openai";
    keyHint.textContent = "Whatever key your gateway issues.";
    modelInput.placeholder = "model id, e.g. gpt-4o-mini";
  } else {
    customPanel.classList.add("hidden");
    deleteCustomBtn.classList.add("hidden");
    modelInput.placeholder = p.defaultModel;
    keyHint.innerHTML = `Get a key from <a href="${p.docsUrl}" target="_blank" rel="noopener">${new URL(p.docsUrl).hostname}</a>.`;
  }

  const savedKey = savedKeyFor(providerId);
  keyInput.value = "";
  keyInput.placeholder = savedKey ? "•••• saved ••••" : "paste key here";
  modelInput.value = state.models[providerId] || "";
}

// chrome.permissions.request() only accepts origins from the OPTIONAL set — an
// origin the manifest already requires is rejected with "Only permissions
// specified in the manifest may be requested." So check first and only ask for
// what is genuinely missing. The lookup is async and would spend the click's
// user gesture, so it runs ahead of time and the result is cached here.
const grantedOrigins = new Set();
const checkedOrigins = new Set();

function probeHostAccess(origin) {
  if (!origin || checkedOrigins.has(origin)) return;
  checkedOrigins.add(origin);
  chrome.permissions.contains({ origins: [origin] }, (has) => {
    if (chrome.runtime.lastError) {
      checkedOrigins.delete(origin);
      return;
    }
    if (has) grantedOrigins.add(origin);
  });
}

function originPatternFor(baseUrl) {
  let u = String(baseUrl || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    return new URL(u).origin + "/*";
  } catch {
    return null;
  }
}

function persist(extra) {
  chrome.storage.local.set({
    keys: state.keys,
    models: state.models,
    customProviders: state.customProviders,
    ...extra,
  });
}

function loadProviders(selectedId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "getProviders" }, (resp) => {
      providers = resp?.providers || [];
      renderProviderOptions(selectedId);
      refreshFieldsForProvider(providerSel.value);
      resolve();
    });
  });
}

function init() {
  chrome.storage.local.get(
    ["keys", "models", "customProviders", "apiKey", "provider"],
    (s) => {
      state.keys = s.keys || {};
      state.models = s.models || {};
      state.customProviders = Array.isArray(s.customProviders)
        ? s.customProviders
        : [];
      state.legacyKey = s.apiKey || "";
      loadProviders(s.provider || "anthropic");
    }
  );
}

let probeTimer = null;
customBaseUrl.addEventListener("input", () => {
  clearTimeout(probeTimer);
  probeTimer = setTimeout(
    () => probeHostAccess(originPatternFor(customBaseUrl.value)),
    250
  );
});

providerSel.addEventListener("change", () => {
  pendingDelete = null;
  deleteCustomBtn.textContent = "Delete this provider";
  refreshFieldsForProvider(providerSel.value);
  if (isCustom(providerSel.value)) {
    probeHostAccess(originPatternFor(customBaseUrl.value));
  }
  setStatus("");
});

saveBtn.addEventListener("click", () => {
  const selected = providerSel.value;
  const newKey = keyInput.value.trim();
  const newModel = modelInput.value.trim();

  if (isCustom(selected)) {
    const name = customName.value.trim();
    const baseUrl = customBaseUrl.value.trim();
    const type = customType.value === "anthropic" ? "anthropic" : "openai";

    if (!baseUrl) {
      setStatus("Please enter the base URL of your API.", "err");
      return;
    }
    const origin = originPatternFor(baseUrl);
    if (!origin) {
      setStatus("That base URL doesn't look like a valid URL.", "err");
      return;
    }

    const id =
      selected === NEW_CUSTOM
        ? CUSTOM_PREFIX + Date.now().toString(36)
        : selected;
    if (!newKey && !savedKeyFor(id)) {
      setStatus("Please paste an API key.", "err");
      return;
    }
    if (!newModel && !state.models[id]) {
      setStatus("Custom providers need a model id.", "err");
      return;
    }

    const entry = {
      id,
      name: name || new URL(origin.replace(/\/\*$/, "")).hostname,
      baseUrl,
      type,
      defaultModel: newModel || state.models[id] || "",
    };
    const at = state.customProviders.findIndex((c) => c.id === id);
    if (at >= 0) state.customProviders[at] = entry;
    else state.customProviders.push(entry);

    if (newKey) state.keys[id] = newKey;
    if (newModel) state.models[id] = newModel;

    // Write first, then ask for host access: requesting a permission can close
    // the popup, and nothing typed should be lost if it does.
    persist({ provider: id });

    const host = new URL(origin.replace(/\/\*$/, "")).hostname;
    const finish = (ok, blockedReason) => {
      loadProviders(id).then(() => {
        if (ok) {
          setStatus(`Saved. Active provider: ${entry.name}.`, "ok");
        } else if (blockedReason) {
          setStatus(
            `Saved, but Chrome wouldn't prompt for ${host} (${blockedReason}) — allow it under chrome://extensions → Details → Site access.`,
            "err"
          );
        } else {
          setStatus(
            `Saved, but ${host} access was denied — replies will fail until you allow it.`,
            "err"
          );
        }
      });
    };

    if (grantedOrigins.has(origin)) {
      finish(true);
      return;
    }

    chrome.permissions.request({ origins: [origin] }, (granted) => {
      const err = chrome.runtime.lastError;
      if (err) {
        // Rejected outright (e.g. the host is already a required permission).
        // Access may well exist anyway, so ask before reporting failure.
        chrome.permissions.contains({ origins: [origin] }, (has) => {
          const hasErr = chrome.runtime.lastError;
          if (has && !hasErr) grantedOrigins.add(origin);
          finish(!!has && !hasErr, has ? null : err.message);
        });
        return;
      }
      if (granted) grantedOrigins.add(origin);
      finish(granted);
    });
    return;
  }

  if (!newKey && !savedKeyFor(selected)) {
    setStatus("Please paste an API key.", "err");
    return;
  }

  if (newKey) state.keys[selected] = newKey;
  if (newModel) state.models[selected] = newModel;
  else delete state.models[selected];

  persist({ provider: selected });
  setStatus(`Saved. Active provider: ${findProvider(selected)?.name}.`, "ok");
  keyInput.value = "";
  keyInput.placeholder = "•••• saved ••••";
});

deleteCustomBtn.addEventListener("click", () => {
  const id = providerSel.value;
  if (!String(id).startsWith(CUSTOM_PREFIX)) return;
  const name = findCustom(id)?.name || "this provider";

  // Two-click confirm — dialogs are unreliable inside an extension popup.
  if (pendingDelete !== id) {
    pendingDelete = id;
    deleteCustomBtn.textContent = "Click again to delete";
    setStatus(`${name} and its saved key will be removed.`, "err");
    return;
  }
  pendingDelete = null;
  deleteCustomBtn.textContent = "Delete this provider";

  state.customProviders = state.customProviders.filter((c) => c.id !== id);
  delete state.keys[id];
  delete state.models[id];
  persist({ provider: "anthropic" });
  loadProviders("anthropic").then(() => setStatus(`Deleted ${name}.`, "ok"));
});

keyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveBtn.click();
});

init();
