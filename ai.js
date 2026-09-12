(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BoundAI = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_BASE = "https://api.openai.com/v1";
  const DEFAULT_MODEL = "gpt-4o-mini";

  function normalizeBound(value) {
    if (!value || typeof value !== "string") return "";
    let s = value.trim();
    s = s.replace(/[𝑂O]\s*\(/, "O(");
    if (!/^O\(/.test(s)) {
      s = s.replace(/^O\s*/i, "");
      s = "O(" + s + ")";
    }
    s = s.replace(/n\s*\*\s*log/gi, "n log");
    s = s.replace(/log_?2?\s*\(\s*n\s*\)/gi, "log n");
    s = s.replace(/log_?2?\s+n/gi, "log n");
    s = s.replace(/n\s*\*\s*n/gi, "n^2");
    s = s.replace(/n²/g, "n^2").replace(/n³/g, "n^3");
    s = s.replace(/²/g, "^2").replace(/³/g, "^3").replace(/ⁿ/g, "^n");
    const pretty = s
      .replace(/n\^2/g, "n²")
      .replace(/n\^3/g, "n³")
      .replace(/n\^4/g, "n⁴")
      .replace(/2\^n/g, "2ⁿ")
      .replace(/k\^n/g, "kⁿ");
    return pretty;
  }

  function parseJsonPayload(text) {
    const raw = String(text || "").trim();
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fence ? fence[1] : raw;
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("The model did not return JSON.");
    return JSON.parse(body.slice(start, end + 1));
  }

  function toResult(payload, meta) {
    const best = normalizeBound(payload.best || payload.average || payload.worst || payload.bound);
    const average = normalizeBound(payload.average || payload.bound || payload.best);
    const worst = normalizeBound(payload.worst || payload.average || payload.best);
    if (!average) {
      throw new Error("The model reply was missing a time bound.");
    }
    const differ = best !== average || average !== worst;
    const patterns = Array.isArray(payload.patterns)
      ? payload.patterns.map(String).filter(Boolean).slice(0, 8)
      : [];
    return {
      status: "ok",
      language: payload.language || meta.language || "unknown",
      best,
      average,
      worst,
      primary: average,
      differ,
      explanation: String(payload.explanation || "").trim() || "The model returned a bound without an explanation.",
      patterns,
      confidence: payload.confidence || "medium",
      engine: "openai",
      source: meta.source || "",
      codePreview: String(meta.code || "").slice(0, 4000),
    };
  }

  async function analyzeWithOpenAI(code, settings, meta) {
    meta = meta || {};
    settings = settings || {};
    const base = String(settings.openaiBaseUrl || DEFAULT_BASE).replace(/\/+$/, "");
    const model = settings.openaiModel || DEFAULT_MODEL;
    const key = String(settings.openaiApiKey || "").trim();
    const url = base + "/chat/completions";

    const messages = [
      {
        role: "system",
        content:
          "You are a programming-contest time-complexity analyst. Estimate Big-O time bounds for the given source. Reply with JSON only.",
      },
      {
        role: "user",
        content: [
          "Return a JSON object with keys:",
          'language (string), best, average, worst (strings like "O(n)", "O(n log n)", "O(n^2)", "O(2^n)", "O(V + E)", "O(1)"),',
          "explanation (2-4 concrete sentences about THIS code), patterns (array of short labels), confidence (high|medium|low).",
          "Use best/average/worst that differ only when it is meaningful (hash tables, quicksort, randomized algorithms).",
          "Otherwise set all three to the same bound.",
          "Do not invent input sizes. If the snippet is incomplete, still estimate from what is present.",
          meta.language ? "Detected language hint: " + meta.language : "",
          meta.source ? "Extracted from: " + meta.source : "",
          "CODE:",
          "```",
          String(code).slice(0, 12000),
          "```",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];

    const body = {
      model,
      temperature: 0,
      messages,
    };
    if (/api\.openai\.com/.test(base)) {
      body.response_format = { type: "json_object" };
    }

    const headers = { "Content-Type": "application/json" };
    if (key) headers.Authorization = "Bearer " + key;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      let detail = text.slice(0, 400);
      try {
        const err = JSON.parse(text);
        detail = (err.error && err.error.message) || err.message || detail;
      } catch (e) {
        /* keep text */
      }
      if (response.status === 401) {
        throw new Error("OpenAI rejected the API key. Check it on the Settings page.");
      }
      if (response.status === 429) {
        throw new Error("The model host rate-limited this request. Wait a moment and try again.");
      }
      throw new Error(detail || "The model host returned HTTP " + response.status + ".");
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("The model host returned a non-JSON response.");
    }
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error("The model host returned an empty completion.");
    const payload = parseJsonPayload(content);
    return toResult(payload, { language: meta.language, source: meta.source, code });
  }

  return {
    analyzeWithOpenAI,
    normalizeBound,
    DEFAULT_BASE,
    DEFAULT_MODEL,
  };
});
