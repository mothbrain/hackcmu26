/**
 * These functions are serialized into the page via chrome.scripting.executeScript.
 * They must stay self-contained — no outer-scope references.
 */

function extractFromMainWorld() {
  const candidates = [];

  function looksCode(text) {
    if (!text || text.trim().length < 2) return false;
    return /\b(def|function|func|fn|class|for|while|return|if|const|let|var|public|void|int|import|package)\b|[{;}=]/.test(
      text
    );
  }

  function clip(text) {
    return String(text || "").replace(/\u00a0/g, " ");
  }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const style = window.getComputedStyle ? getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return r.bottom > 0 && r.top < (window.innerHeight || 1) && r.right > 0 && r.left < (window.innerWidth || 1);
  }

  function push(entry) {
    const code = clip(entry.code);
    if (!code.trim()) return;
    if (code.length > 200000) return;
    const extra = looksCode(code) ? 20 : 0;
    const vis = entry.el && visible(entry.el) ? 25 : 0;
    candidates.push({
      source: entry.source,
      language: entry.language || "",
      code,
      score: (entry.score || 0) + extra + vis + Math.min(40, Math.floor(code.length / 80)),
    });
  }

  try {
    const sel = window.getSelection && window.getSelection().toString();
    if (sel && sel.trim().length > 12 && looksCode(sel)) {
      push({ source: "Selected text", code: sel, score: 220 });
    }
  } catch (e) {
    /* ignore */
  }

  try {
    if (window.monaco && monaco.editor) {
      const editors = typeof monaco.editor.getEditors === "function" ? monaco.editor.getEditors() : [];
      const seen = new Set();
      for (let i = 0; i < editors.length; i++) {
        const ed = editors[i];
        let model = null;
        try {
          model = ed.getModel && ed.getModel();
        } catch (e) {
          model = null;
        }
        if (!model || typeof model.getValue !== "function") continue;
        const uri = String((model.uri && model.uri.toString && model.uri.toString()) || "");
        if (seen.has(uri + model.id)) continue;
        seen.add(uri + model.id);
        let focused = false;
        try {
          focused = !!(ed.hasTextFocus && ed.hasTextFocus());
        } catch (e) {
          focused = false;
        }
        let lang = "";
        try {
          lang = model.getLanguageId ? model.getLanguageId() : "";
        } catch (e) {
          lang = "";
        }
        const el = ed.getDomNode ? ed.getDomNode() : document.querySelector(".monaco-editor");
        push({
          source: focused ? "Monaco editor (focused)" : "Monaco editor",
          language: lang,
          code: model.getValue(),
          score: focused ? 170 : 145,
          el,
        });
      }
      if (typeof monaco.editor.getModels === "function" && !candidates.some((c) => /Monaco/.test(c.source))) {
        const models = monaco.editor.getModels();
        for (let i = 0; i < models.length; i++) {
          const model = models[i];
          const value = model.getValue && model.getValue();
          if (!value || value.trim().length < 2) continue;
          let lang = "";
          try {
            lang = model.getLanguageId ? model.getLanguageId() : "";
          } catch (e) {
            lang = "";
          }
          push({
            source: "Monaco model",
            language: lang,
            code: value,
            score: 120,
            el: document.querySelector(".monaco-editor"),
          });
        }
      }
    }
  } catch (e) {
    /* ignore */
  }

  try {
    const aceNodes = document.querySelectorAll(".ace_editor, .ace-editor");
    for (let i = 0; i < aceNodes.length; i++) {
      const el = aceNodes[i];
      if (!window.ace || !ace.edit) break;
      try {
        const editor = ace.edit(el);
        const value = editor.getValue && editor.getValue();
        let lang = "";
        try {
          lang = editor.session && editor.session.getMode && editor.session.getMode().$id;
        } catch (e) {
          lang = "";
        }
        push({ source: "Ace editor", language: lang || "", code: value, score: 140, el });
      } catch (e) {
        /* ignore */
      }
    }
  } catch (e) {
    /* ignore */
  }

  try {
    const cm5 = document.querySelectorAll(".CodeMirror");
    for (let i = 0; i < cm5.length; i++) {
      const el = cm5[i];
      if (el.CodeMirror && typeof el.CodeMirror.getValue === "function") {
        push({ source: "CodeMirror", code: el.CodeMirror.getValue(), score: 140, el });
      }
    }
  } catch (e) {
    /* ignore */
  }

  try {
    const cm6 = document.querySelectorAll(".cm-editor");
    for (let i = 0; i < cm6.length; i++) {
      const el = cm6[i];
      const view = (el.cmView && el.cmView.view) || (el._cmView && el._cmView.view);
      if (view && view.state && view.state.doc && typeof view.state.doc.toString === "function") {
        push({ source: "CodeMirror 6", code: view.state.doc.toString(), score: 140, el });
      }
    }
  } catch (e) {
    /* ignore */
  }

  return {
    href: location.href,
    host: location.hostname,
    world: "main",
    candidates,
  };
}

function extractFromIsolatedWorld() {
  const candidates = [];

  function looksCode(text) {
    if (!text || text.trim().length < 2) return false;
    return /\b(def|function|func|fn|class|for|while|return|if|const|let|var|public|void|int|import|package)\b|[{;}=]/.test(
      text
    );
  }

  function clip(text) {
    return String(text || "").replace(/\u00a0/g, " ");
  }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const style = window.getComputedStyle ? getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return r.bottom > 0 && r.top < (window.innerHeight || 1) && r.right > 0 && r.left < (window.innerWidth || 1);
  }

  function push(entry) {
    const code = clip(entry.code);
    if (!code.trim()) return;
    if (code.length > 200000) return;
    const extra = looksCode(code) ? 20 : 0;
    const vis = entry.el && visible(entry.el) ? 25 : 0;
    candidates.push({
      source: entry.source,
      language: entry.language || "",
      code,
      score: (entry.score || 0) + extra + vis + Math.min(40, Math.floor(code.length / 80)),
    });
  }

  try {
    const sel = window.getSelection && window.getSelection().toString();
    if (sel && sel.trim().length > 12 && looksCode(sel)) {
      push({ source: "Selected text", code: sel, score: 220 });
    }
  } catch (e) {
    /* ignore */
  }

  const monacoLines = document.querySelectorAll(".monaco-editor .view-lines");
  for (let i = 0; i < monacoLines.length; i++) {
    const text = monacoLines[i].innerText;
    if (text && text.trim().length > 2) {
      push({
        source: "Monaco visible lines",
        code: text,
        score: 80,
        el: monacoLines[i],
      });
    }
  }

  const cmContent = document.querySelectorAll(".cm-content, .CodeMirror-code");
  for (let i = 0; i < cmContent.length; i++) {
    const text = cmContent[i].innerText;
    if (text && text.trim().length > 2) {
      push({ source: "CodeMirror visible lines", code: text, score: 75, el: cmContent[i] });
    }
  }

  const aceContent = document.querySelectorAll(".ace_text-layer");
  for (let i = 0; i < aceContent.length; i++) {
    const text = aceContent[i].innerText;
    if (text && text.trim().length > 2) {
      push({ source: "Ace visible lines", code: text, score: 75, el: aceContent[i] });
    }
  }

  const textareas = document.querySelectorAll("textarea");
  for (let i = 0; i < textareas.length; i++) {
    const el = textareas[i];
    const value = el.value || "";
    if (value.trim().length < 8) continue;
    if (!looksCode(value)) continue;
    push({ source: "Text area", code: value, score: 60, el });
  }

  const blocks = document.querySelectorAll("pre code, pre, code");
  for (let i = 0; i < blocks.length; i++) {
    const el = blocks[i];
    if (el.closest && el.closest("pre") && el.tagName === "CODE" && el.parentElement && el.parentElement.tagName === "PRE") {
      /* prefer the inner code; still fine to take it */
    }
    if (el.tagName === "PRE" && el.querySelector("code")) continue;
    const text = el.innerText || "";
    if (text.trim().length < 8) continue;
    if (!looksCode(text)) continue;
    const inNav = el.closest && el.closest("nav, header, footer");
    push({
      source: el.tagName === "PRE" || (el.parentElement && el.parentElement.tagName === "PRE") ? "Code block" : "Inline code",
      code: text,
      score: inNav ? 10 : 45,
      el,
    });
  }

  const github = document.querySelectorAll(".blob-code-inner, td.blob-code");
  if (github.length > 4) {
    const lines = [];
    for (let i = 0; i < github.length; i++) lines.push(github[i].innerText.replace(/\n/g, ""));
    push({
      source: "GitHub blob",
      code: lines.join("\n"),
      score: 90,
      el: github[0],
    });
  }

  return {
    href: location.href,
    host: location.hostname,
    world: "isolated",
    candidates,
  };
}
