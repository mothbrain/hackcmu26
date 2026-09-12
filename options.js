const DEFAULTS = {
  engine: "local",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  openaiBaseUrl: "https://api.openai.com/v1",
};

const $ = (id) => document.getElementById(id);

async function load() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

function fill(settings) {
  $("engine").value = settings.engine === "openai" ? "openai" : "local";
  $("api-key").value = settings.openaiApiKey || "";
  $("model").value = settings.openaiModel || DEFAULTS.openaiModel;
  $("base-url").value = settings.openaiBaseUrl || DEFAULTS.openaiBaseUrl;
}

async function maybeRequestHost(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch (e) {
    throw new Error("API base URL must be an absolute URL, for example https://api.openai.com/v1");
  }
  if (url.origin === "https://api.openai.com") return;
  const origin = url.origin + "/*";
  const ok = await chrome.permissions.request({ origins: [origin] });
  if (!ok) throw new Error("Permission to reach " + url.origin + " was not granted.");
}

async function save() {
  $("error").textContent = "";
  const openaiBaseUrl = $("base-url").value.trim() || DEFAULTS.openaiBaseUrl;
  const engine = $("engine").value;
  try {
    if (engine === "openai") await maybeRequestHost(openaiBaseUrl);
  } catch (err) {
    $("error").textContent = err.message;
    $("error").className = "fine danger";
    return;
  }
  await chrome.storage.local.set({
    engine,
    openaiApiKey: $("api-key").value.trim(),
    openaiModel: $("model").value.trim() || DEFAULTS.openaiModel,
    openaiBaseUrl,
  });
  $("save-status").textContent = "Saved";
  setTimeout(() => {
    $("save-status").textContent = "";
  }, 1600);
}

load().then(fill);
$("save").addEventListener("click", save);
