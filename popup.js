const isExtension = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;

const DEFAULTS = {
  engine: "local",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  openaiBaseUrl: "https://api.openai.com/v1",
};

const SAMPLES = [
  {
    label: "Nested loops",
    code: `def twoSumBrute(nums, target):\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]\n    return []`,
  },
  {
    label: "Hash map two-sum",
    code: `def twoSum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n    return []`,
  },
  {
    label: "Binary search",
    code: `def search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1`,
  },
];

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadSettings() {
  if (!isExtension || !chrome.storage || !chrome.storage.local) return { ...DEFAULTS };
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function saveSettings(partial) {
  const current = await loadSettings();
  const next = { ...current, ...partial };
  if (isExtension) await chrome.storage.local.set(next);
  return next;
}

function restrictedUrl(url) {
  if (!url) return true;
  return /^(chrome|edge|about|chrome-extension|moz-extension|devtools):/i.test(url) ||
    /chrome\.google\.com\/webstore|chromewebstore\.google\.com/.test(url);
}

function pickCandidate(candidates) {
  if (!candidates || !candidates.length) return null;
  const ranked = candidates.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
  const seen = new Set();
  for (const c of ranked) {
    const key = c.code.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    if (typeof BoundAnalyzer !== "undefined" && BoundAnalyzer.looksLikeCode && !BoundAnalyzer.looksLikeCode(c.code)) {
      continue;
    }
    return c;
  }
  return ranked[0];
}

function mergeExtractions(results) {
  const candidates = [];
  let host = "";
  let href = "";
  for (const entry of results || []) {
    if (!entry || !entry.result) continue;
    const r = entry.result;
    host = r.host || host;
    href = r.href || href;
    if (Array.isArray(r.candidates)) candidates.push(...r.candidates);
  }
  return { host, href, candidates };
}

async function extractFromTab(tabId) {
  const worlds = [];
  try {
    worlds.push(
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        world: "MAIN",
        func: extractFromMainWorld,
      })
    );
  } catch (e) {
    /* MAIN world can fail on some pages */
  }
  worlds.push(
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "ISOLATED",
      func: extractFromIsolatedWorld,
    })
  );
  const flat = [];
  for (const group of worlds) {
    if (Array.isArray(group)) flat.push(...group);
  }
  return mergeExtractions(flat);
}

async function ensureCustomHostPermission(baseUrl) {
  if (!isExtension || !chrome.permissions || !chrome.permissions.request) return true;
  let origin;
  try {
    origin = new URL(baseUrl).origin + "/*";
  } catch (e) {
    throw new Error("That API base URL is not valid.");
  }
  if (/^https:\/\/api\.openai\.com\//.test(origin.replace("/*", "/"))) return true;
  const already = await chrome.permissions.contains({ origins: [origin] });
  if (already) return true;
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) throw new Error("Bound needs permission to reach " + origin.replace("/*", "") + ".");
  return true;
}

async function runAnalysis(code, meta, settings) {
  const local = BoundAnalyzer.analyze(code, meta);
  const wantAI = settings.engine === "openai";
  const hasKey = String(settings.openaiApiKey || "").trim().length > 0;
  const base = settings.openaiBaseUrl || BoundAI.DEFAULT_BASE;
  const custom = base.replace(/\/+$/, "") !== BoundAI.DEFAULT_BASE;

  if (!wantAI) return local;
  if (!hasKey && !custom) {
    return {
      ...local,
      fallback: true,
      aiError: "OpenAI is selected, but no API key is saved. Using the on-device checker.",
    };
  }

  try {
    await ensureCustomHostPermission(base);
    const ai = await BoundAI.analyzeWithOpenAI(code, settings, meta);
    return ai;
  } catch (err) {
    return {
      ...local,
      fallback: true,
      aiError: (err && err.message) || "ChatGPT analysis failed. Showing the on-device result instead.",
    };
  }
}

function renderState(html) {
  $("main").innerHTML = html;
}

function renderMessage(title, body, extra) {
  renderState(
    `<div class="state">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(body)}</p>
      ${extra || ""}
    </div>`
  );
}

function renderResult(result, picked, page) {
  const banners = [];
  if (result.fallback && result.aiError) {
    banners.push(`<div class="banner error">${escapeHtml(result.aiError)}</div>`);
  }
  const engineLabel =
    result.engine === "openai" ? "ChatGPT" : result.fallback ? "On-device (fallback)" : "On-device";
  const trio = result.differ
    ? `<div class="trio">
        <div><span>Best</span><strong>${escapeHtml(result.best)}</strong></div>
        <div><span>Average</span><strong>${escapeHtml(result.average)}</strong></div>
        <div><span>Worst</span><strong>${escapeHtml(result.worst)}</strong></div>
      </div>`
    : "";
  const chips = (result.patterns || []).map((p) => `<span class="chip">${escapeHtml(p)}</span>`).join("");
  const preview = result.codePreview || (picked && picked.code) || "";
  renderState(`
    ${banners.join("")}
    <div class="meta">
      <span>${escapeHtml((picked && picked.source) || result.source || "Code on page")}</span>
      <span>${escapeHtml(page && page.host ? page.host : "")}</span>
      <span>${escapeHtml(engineLabel)}</span>
      ${result.language && result.language !== "unknown" ? `<span>${escapeHtml(result.language)}</span>` : ""}
    </div>
    <div class="bound">${escapeHtml(result.primary || result.average)}</div>
    ${trio}
    <p class="why">${escapeHtml(result.explanation || "")}</p>
    <div class="chips">${chips}</div>
    <details>
      <summary>Code Bound read</summary>
      <pre>${escapeHtml(preview.slice(0, 2500))}</pre>
    </details>
  `);
}

function demoExtra() {
  const buttons = SAMPLES.map(
    (s, i) => `<button type="button" data-sample="${i}">Try ${escapeHtml(s.label)}</button>`
  ).join("");
  return `<label class="field" style="text-transform:none;letter-spacing:0;margin-top:12px">
      <span>Paste code</span>
      <textarea id="paste" placeholder="Paste a function, then analyze"></textarea>
    </label>
    <button type="button" class="primary" id="analyze-paste">Analyze pasted code</button>
    <div class="samples">${buttons}</div>`;
}

async function analyzeText(code, settings, meta, page) {
  renderState(`<div class="state"><div class="pulse"></div><p>Working out a bound…</p></div>`);
  const result = await runAnalysis(code, meta || {}, settings);
  if (result.status === "empty") {
    renderMessage("Nothing to read", result.message, isExtension ? "" : demoExtra());
    bindDemo(settings);
    return;
  }
  if (result.status === "no_code") {
    renderMessage("No code found", result.message, isExtension ? "" : demoExtra());
    bindDemo(settings);
    return;
  }
  if (result.status === "failure") {
    renderMessage("Analysis failed", result.message);
    return;
  }
  renderResult(result, { source: (meta && meta.source) || "Pasted code", code }, page);
}

function bindDemo(settings) {
  const pasteBtn = $("analyze-paste");
  if (pasteBtn) {
    pasteBtn.addEventListener("click", () => {
      const code = ($("paste") && $("paste").value) || "";
      analyzeText(code, settings, { source: "Pasted code" }, { host: "local preview" });
    });
  }
  document.querySelectorAll("[data-sample]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sample = SAMPLES[Number(btn.getAttribute("data-sample"))];
      if ($("paste")) $("paste").value = sample.code;
      analyzeText(sample.code, settings, { source: sample.label }, { host: "local preview" });
    });
  });
}

async function analyzeActiveTab(settings) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) {
    renderMessage("No active tab", "Open a page that shows code, then click Bound again.");
    return;
  }
  if (restrictedUrl(tab.url)) {
    renderMessage(
      "This page is locked",
      "Chrome blocks extensions on browser pages like this one. Open LeetCode, HackerRank, or any page with an editor, then try again."
    );
    return;
  }
  renderState(`<div class="state"><div class="pulse"></div><p>Reading the editor…</p></div>`);
  let extraction;
  try {
    extraction = await extractFromTab(tab.id);
  } catch (err) {
    renderMessage(
      "Could not read the page",
      err && err.message
        ? err.message
        : "Bound did not get access to this tab. Click the toolbar icon while the coding page is focused."
    );
    return;
  }
  const picked = pickCandidate(extraction.candidates);
  if (!picked) {
    renderMessage(
      "No code on this page",
      "Bound looked for a Monaco, CodeMirror, or Ace editor, and for pre/code blocks. Open a solution editor or select a snippet, then try again."
    );
    return;
  }
  const result = await runAnalysis(picked.code, { source: picked.source, language: picked.language }, settings);
  if (result.status === "empty") {
    renderMessage("Empty editor", result.message);
    return;
  }
  if (result.status === "no_code") {
    renderMessage("No code found", result.message);
    return;
  }
  if (result.status === "failure") {
    renderMessage("Analysis failed", result.message);
    return;
  }
  renderResult(result, picked, extraction);
}

function fillSettingsForm(settings) {
  $("engine").value = settings.engine === "openai" ? "openai" : "local";
  $("api-key").value = settings.openaiApiKey || "";
  $("model").value = settings.openaiModel || DEFAULTS.openaiModel;
}

async function init() {
  const settings = await loadSettings();
  fillSettingsForm(settings);

  $("settings-toggle").addEventListener("click", () => {
    const panel = $("settings-panel");
    const open = panel.hasAttribute("hidden");
    if (open) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
    panel.classList.toggle("hidden", !open);
    $("settings-toggle").setAttribute("aria-expanded", String(open));
  });

  $("save-settings").addEventListener("click", async () => {
    const next = await saveSettings({
      engine: $("engine").value,
      openaiApiKey: $("api-key").value.trim(),
      openaiModel: $("model").value.trim() || DEFAULTS.openaiModel,
    });
    $("save-status").textContent = "Saved";
    setTimeout(() => {
      $("save-status").textContent = "";
    }, 1500);
    if (isExtension) analyzeActiveTab(next);
  });

  $("open-options").addEventListener("click", (event) => {
    event.preventDefault();
    if (isExtension && chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else window.open("options.html", "_blank");
  });

  if (!isExtension) {
    renderMessage(
      "Preview",
      "This is Bound’s popup. In Chrome it reads the active tab. Here you can paste a snippet or try a sample.",
      demoExtra()
    );
    bindDemo(settings);
    return;
  }

  await analyzeActiveTab(settings);
}

init().catch((err) => {
  renderMessage("Bound hit a snag", err && err.message ? err.message : "Unexpected error while starting the popup.");
});
