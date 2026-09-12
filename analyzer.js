(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BoundAnalyzer = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ONE = { n: 0, log: 0, exp: 0, fact: false, graph: false };
  const N = { n: 1, log: 0, exp: 0, fact: false, graph: false };
  const LOG = { n: 0, log: 1, exp: 0, fact: false, graph: false };
  const NLOG = { n: 1, log: 1, exp: 0, fact: false, graph: false };
  const N2 = { n: 2, log: 0, exp: 0, fact: false, graph: false };
  const EXP2 = { n: 0, log: 0, exp: 2, fact: false, graph: false };
  const FACT = { n: 0, log: 0, exp: 0, fact: true, graph: false };
  const GRAPH = { n: 0, log: 0, exp: 0, fact: false, graph: true };

  const CONTROL = new Set([
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "catch",
    "try",
    "finally",
    "with",
    "elif",
    "except",
    "foreach",
  ]);

  function copy(c) {
    return { n: c.n, log: c.log, exp: c.exp, fact: c.fact, graph: c.graph };
  }

  function rank(c) {
    if (c.fact) return [6, 0, 0, 0];
    if (c.exp) return [5, c.exp, 0, 0];
    if (c.graph) return [3.4, 0, 0, 0];
    return [Math.min(c.n, 4), c.n, c.log, 0];
  }

  function worse(a, b) {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) {
      if (ra[i] !== rb[i]) return ra[i] > rb[i] ? a : b;
    }
    return a;
  }

  function add(a, b) {
    return copy(worse(a, b));
  }

  function mul(a, b) {
    if (a.fact || b.fact) return copy(FACT);
    if (a.exp || b.exp) return { n: 0, log: 0, exp: Math.max(a.exp, b.exp, 2), fact: false, graph: false };
    if (a.graph || b.graph) {
      if ((a.graph && isOne(b)) || (b.graph && isOne(a))) return copy(GRAPH);
      return add(a.graph ? N : a, b.graph ? N : b);
    }
    return { n: a.n + b.n, log: a.log + b.log, exp: 0, fact: false, graph: false };
  }

  function isOne(c) {
    return !c.fact && !c.exp && !c.graph && c.n === 0 && c.log === 0;
  }

  const SUP = { 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶" };

  function formatCost(c) {
    if (!c) return { ascii: "O(1)", pretty: "O(1)" };
    if (c.fact) return { ascii: "O(n!)", pretty: "O(n!)" };
    if (c.exp) {
      const base = c.exp === 2 ? "2" : String(c.exp);
      return { ascii: `O(${base}^n)`, pretty: `O(${base}ⁿ)` };
    }
    if (c.graph) return { ascii: "O(V + E)", pretty: "O(V + E)" };
    if (c.n === 0 && c.log === 0) return { ascii: "O(1)", pretty: "O(1)" };
    const prettyParts = [];
    const asciiParts = [];
    if (c.n === 1) {
      prettyParts.push("n");
      asciiParts.push("n");
    } else if (c.n > 1) {
      prettyParts.push("n" + (SUP[c.n] || `^${c.n}`));
      asciiParts.push(`n^${c.n}`);
    }
    if (c.log === 1) {
      prettyParts.push("log n");
      asciiParts.push("log n");
    } else if (c.log > 1) {
      prettyParts.push(`(log n)${SUP[c.log] || `^${c.log}`}`);
      asciiParts.push(`(log n)^${c.log}`);
    }
    return {
      ascii: `O(${asciiParts.join(" ")})`,
      pretty: `O(${prettyParts.join(" ")})`,
    };
  }

  function detectLanguage(code) {
    const sample = code.slice(0, 4000);
    if (/^\s*#include\b|\bstd::|int\s+main\s*\(/.test(sample)) return "cpp";
    if (/\bpublic\s+class\b|\bSystem\.out\b|\bHashMap\s*</.test(sample)) return "java";
    if (/\bfunc\s+\w+\s*\(|\bpackage\s+\w+/.test(sample) && /\bfunc\b/.test(sample)) return "go";
    if (/\bfn\s+\w+\s*\(|\blet\s+mut\b/.test(sample)) return "rust";
    if (/\bdef\s+\w+\s*\(|^\s*elif\b|^\s*except\b|\bself\b/m.test(sample) && !/\bfunction\b/.test(sample)) {
      return "python";
    }
    if (/\bfunction\b|\bconst\s+\w+\s*=|\blet\s+\w+\s*=|\bconsole\.log/.test(sample)) return "javascript";
    if (/\bdef\s+\w+/.test(sample)) return "python";
    return "unknown";
  }

  function looksLikeCode(code) {
    const text = String(code || "").trim();
    if (text.length < 2) return false;
    const lines = text.split(/\n/).filter((l) => l.trim());
    if (!lines.length) return false;

    const strong =
      /\b(def\s+\w+\s*\(|async\s+def\s+|function\s+\w+|func\s+\w+|fn\s+\w+|class\s+\w+|#include\b|public\s+(class|static|void|int)|System\.out|console\.log|from\s+\w+\s+import|import\s+[A-Za-z_*])/.test(
        text
      );
    const loops = /\b(for\s*\(|for\s+\w+\s+in\b|while\s*\(|foreach\s*\()/.test(text);
    const syntax = /[{}]\s*$|=>|:=|::|===|;$/.test(text) || /{\s*$/m.test(text) || /;\s*$/m.test(text);
    const assignment = lines.filter((l) => /^\s*[\w.]+\s*=\s*.+/.test(l)).length >= 1;
    const indentBlock = lines.length > 1 && lines.some((l) => /^\s{2,}\S/.test(l) || /^\t\S/.test(l));
    const english = (text.match(/\b(the|this|that|with|your|have|problem|given|should|would|you|may|each|than|then)\b/gi) || [])
      .length;
    const tokens = text.split(/\s+/).length;
    const sentenceLike = /[a-z][.?!]\s+[A-Z]/.test(text) || (/^[A-Z][^.=;{]{20,}[.?!]$/.test(text) && lines.length <= 3);
    const proseHeavy = sentenceLike && english >= 5 && english / Math.max(tokens, 1) > 0.08 && !strong && !loops;

    if (proseHeavy && !syntax) return false;
    if (strong || loops) return true;
    if (syntax && text.length > 8) return true;
    if (assignment && (lines.length > 1 || /return\b|print\b/.test(text))) return true;
    if (indentBlock && /\b(return|if|else|elif)\b/.test(text)) return true;
    return false;
  }

  function stripNoise(code, language) {
    let out = "";
    const src = String(code);
    const python = language === "python";
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      const two = src.slice(i, i + 2);

      if (!python && two === "//") {
        while (i < src.length && src[i] !== "\n") i++;
        continue;
      }
      if (!python && two === "/*") {
        i += 2;
        while (i < src.length && src.slice(i, i + 2) !== "*/") i++;
        i += 2;
        out += " ";
        continue;
      }
      if (python && c === "#") {
        while (i < src.length && src[i] !== "\n") i++;
        continue;
      }
      if (python && (two === '"""' || two === "'''")) {
        const q = two;
        i += 2;
        const next = src.indexOf(q, i);
        i = next < 0 ? src.length : next + 2;
        out += '""';
        continue;
      }
      if (c === '"' || c === "'" || (!python && c === "`")) {
        const q = c;
        i++;
        while (i < src.length && src[i] !== q) {
          if (src[i] === "\\") i += 2;
          else i++;
        }
        i++;
        out += '""';
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }

  function getIndent(line) {
    const m = line.match(/^[\t ]*/);
    if (!m) return 0;
    return m[0].replace(/\t/g, "    ").length;
  }

  function matchPair(code, start, open, close) {
    let depth = 0;
    for (let i = start; i < code.length; i++) {
      if (code[i] === open) depth++;
      else if (code[i] === close) {
        depth--;
        if (depth === 0) return i;
      }
    }
    return code.length - 1;
  }

  function skipSpace(code, i) {
    while (i < code.length && /\s/.test(code[i])) i++;
    return i;
  }

  function classifyLoop(header, body) {
    const h = header || "";
    const s = (h + " " + String(body || "").slice(0, 600)).replace(/\s+/g, " ");

    if (/range\(\s*\d{1,3}\s*\)/.test(h) && !/range\(\s*[A-Za-z_]/.test(h)) return copy(ONE);
    if (/[<>]=?\s*\d{1,3}\s*[;\){,]/.test(h) && !/[<>]=?\s*[A-Za-z_]/.test(h)) return copy(ONE);

    const loggy =
      /(\*=\s*2|\/=\s*2|<<\s*=|>>\s*=|\bmid\b|\bleft\b.*\bright\b|\blow\b.*\bhigh\b|\blo\b.*\bhi\b|\bl\b\s*[<>=].*\br\b)/.test(
        s
      );
    if (/\bwhile\b/.test(h) && loggy) return copy(LOG);
    if (loggy && /(\/=|\*=|>>|<<|\/\/\s*2)/.test(h)) return copy(LOG);
    return copy(N);
  }

  function findLoopsPython(code) {
    const lines = code.split(/\n/);
    const loops = [];
    for (let idx = 0; idx < lines.length; idx++) {
      const raw = lines[idx];
      const t = raw.trim();
      if (/^for\b/.test(t) || /^while\b/.test(t)) {
        const indent = getIndent(raw);
        let body = "";
        for (let j = idx + 1; j < lines.length; j++) {
          if (!lines[j].trim()) continue;
          const ji = getIndent(lines[j]);
          if (ji <= indent) break;
          body += lines[j] + "\n";
        }
        const startLine = idx;
        let endLine = idx;
        for (let j = idx + 1; j < lines.length; j++) {
          if (!lines[j].trim()) {
            endLine = j;
            continue;
          }
          if (getIndent(lines[j]) <= indent) break;
          endLine = j;
        }
        loops.push({
          line: startLine,
          endLine,
          indent,
          header: t,
          factor: classifyLoop(t, body),
        });
      }
    }
    return loops;
  }

  function findLoopsClike(code) {
    const loops = [];
    const re = /\b(for|while|foreach|do)\b/g;
    let m;
    while ((m = re.exec(code))) {
      if (m[1] === "do") {
        let i = skipSpace(code, m.index + 2);
        let bodyEnd = i;
        if (code[i] === "{") bodyEnd = matchPair(code, i, "{", "}");
        else {
          const semi = code.indexOf(";", i);
          bodyEnd = semi < 0 ? code.length : semi;
        }
        const body = code.slice(i, bodyEnd + 1);
        loops.push({
          index: m.index,
          bodyStart: i,
          bodyEnd,
          header: "do while",
          factor: classifyLoop("do while", body),
        });
        continue;
      }
      let i = m.index + m[1].length;
      i = skipSpace(code, i);
      if (code[i] === "(") {
        const close = matchPair(code, i, "(", ")");
        const header = code.slice(m.index, close + 1);
        i = skipSpace(code, close + 1);
        let bodyEnd;
        if (code[i] === "{") bodyEnd = matchPair(code, i, "{", "}");
        else {
          const nextLoop = code.slice(i).search(/\b(for|while|foreach)\b/);
          const semi = code.indexOf(";", i);
          if (nextLoop >= 0 && (semi < 0 || i + nextLoop < semi)) {
            bodyEnd = code.length;
            const inner = findLoopBodyEnd(code, i + nextLoop);
            bodyEnd = inner;
          } else bodyEnd = semi < 0 ? code.length : semi;
        }
        const body = code.slice(i, bodyEnd + 1);
        loops.push({
          index: m.index,
          bodyStart: i,
          bodyEnd,
          header,
          factor: classifyLoop(header, body),
        });
      }
    }
    return loops;
  }

  function findLoopBodyEnd(code, keywordIndex) {
    let i = keywordIndex;
    while (i < code.length && /\w/.test(code[i])) i++;
    i = skipSpace(code, i);
    if (code[i] === "(") i = matchPair(code, i, "(", ")") + 1;
    i = skipSpace(code, i);
    if (code[i] === "{") return matchPair(code, i, "{", "}");
    const semi = code.indexOf(";", i);
    return semi < 0 ? code.length : semi;
  }

  function nestedProductPython(loops) {
    let best = copy(ONE);
    for (let i = 0; i < loops.length; i++) {
      let product = copy(loops[i].factor);
      let indent = loops[i].indent;
      for (let j = i - 1; j >= 0; j--) {
        if (loops[j].indent < indent && loops[i].line <= loops[j].endLine && loops[i].line > loops[j].line) {
          product = mul(product, loops[j].factor);
          indent = loops[j].indent;
        }
      }
      best = add(best, product);
    }
    return best;
  }

  function nestedProductClike(loops) {
    let best = copy(ONE);
    for (let i = 0; i < loops.length; i++) {
      let product = copy(loops[i].factor);
      for (let j = 0; j < loops.length; j++) {
        if (j === i) continue;
        if (loops[i].index > loops[j].bodyStart && loops[i].index < loops[j].bodyEnd) {
          product = mul(product, loops[j].factor);
        }
      }
      best = add(best, product);
    }
    return best;
  }

  function findPythonFunctions(code) {
    const lines = code.split(/\n/);
    const fns = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^( *)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/);
      if (!m) continue;
      const indent = m[1].replace(/\t/g, "    ").length;
      const name = m[2];
      let header = lines[i];
      for (let k = i - 1; k >= 0; k--) {
        if (/^\s*@/.test(lines[k])) header = lines[k] + "\n" + header;
        else if (!lines[k].trim()) continue;
        else break;
      }
      const bodyLines = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim()) {
          bodyLines.push(lines[j]);
          continue;
        }
        if (getIndent(lines[j]) <= indent) break;
        bodyLines.push(lines[j]);
      }
      fns.push({ name, body: bodyLines.join("\n"), header });
    }
    return fns;
  }

  function findClikeFunctions(code) {
    const fns = [];
    const re = /\b(?:function\s+)?([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/g;
    let m;
    while ((m = re.exec(code))) {
      const name = m[1];
      if (CONTROL.has(name)) continue;
      const brace = m.index + m[0].length - 1;
      const end = matchPair(code, brace, "{", "}");
      const body = code.slice(brace + 1, end);
      fns.push({ name, body, header: m[0] });
    }
    return fns;
  }

  function callCount(name, body) {
    const re = new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(", "g");
    return (body.match(re) || []).length;
  }

  function isMemoized(header, body) {
    const s = header + "\n" + body;
    return /@cache|@lru_cache|\bmemo\b|\bmemoize|\bdp\s*[\[{]|lru_cache|HashMap.*memo|unordered_map.*memo/.test(s);
  }

  function recursionCost(fn, inner) {
    const body = fn.body || "";
    const calls = callCount(fn.name, body);
    if (calls <= 0) return inner;

    const halved =
      /\bmid\b/.test(body) ||
      /\/\s*2/.test(body) ||
      />>\s*1/.test(body) ||
      /:\s*mid|mid\s*:/.test(body);
    const decrement = /n\s*-\s*[12]/.test(body) || new RegExp("\\b" + fn.name + "\\s*\\(\\s*\\w+\\s*-\\s*1").test(body);
    const treeish = /\.left\b|\.right\b|\bchildren\b|\bleft\b|\bright\b/.test(body) && !/n\s*-\s*[12]/.test(body);
    const memo = isMemoized(fn.header, body);

    if (halved && calls >= 2) {
      if (inner.n > 1) return copy(inner);
      if (inner.n === 1) return { n: 1, log: inner.log + 1, exp: 0, fact: false, graph: false };
      return copy(N);
    }
    if (halved && calls === 1) {
      if (isOne(inner)) return copy(LOG);
      if (inner.n >= 1) return copy(inner);
      return add(LOG, inner);
    }
    if (calls >= 2 && treeish && !/n\s*-\s*[12]/.test(body)) {
      return add(inner, N);
    }
    if (calls >= 2) {
      if (memo) return inner.n >= 1 ? copy(inner) : copy(N);
      if (decrement || /n\s*-\s*[12]/.test(body)) return copy(EXP2);
      return copy(EXP2);
    }
    if (decrement && calls === 1) {
      return mul(N, inner);
    }
    if (calls >= 1 && memo) return inner.n >= 1 ? copy(inner) : copy(N);
    return inner;
  }

  function extraOpCost(code) {
    let extra = copy(ONE);
    if (/\b(sorted\s*\(|\.sort\s*\(|Arrays\.sort|Collections\.sort|std::sort|sort\s*\()/.test(code)) {
      extra = add(extra, NLOG);
    }
    if (/\b(heapq|heappush|heappop|priority_queue|PriorityQueue|BinaryHeap)\b/.test(code)) {
      extra = add(extra, NLOG);
    }
    if (/\b(bisect|binary_search|lower_bound|upper_bound)\b/.test(code)) {
      extra = add(extra, LOG);
    }
    if (/\bpermutations\s*\(/.test(code) || /\bn!/.test(code)) extra = add(extra, FACT);
    return extra;
  }

  function detectGraph(code) {
    const graphWords = /\b(adj|adjacency|neighbors|neighbours|graph|edges|vertices|List\s*<\s*List)\b/i.test(code);
    const walk = /\b(queue|deque|stack|visited|bfs|dfs|topo)\b/i.test(code);
    return graphWords && walk;
  }

  function detectHash(code) {
    return (
      /\b(dict|defaultdict|Counter|HashMap|unordered_map|HashSet|unordered_set|Map\s*<|Set\s*<|set\(\)|new Map|new Set)\b/.test(
        code
      ) ||
      /\w+\s*=\s*\{\s*\}/.test(code) ||
      /\b(in seen|in memo|in used)\b/.test(code)
    );
  }

  function detectQuicksort(code) {
    return /\b(quicksort|quick_sort|quickSort)\b/.test(code);
  }

  function loopCostFor(code, language) {
    if (language === "python") return nestedProductPython(findLoopsPython(code));
    return nestedProductClike(findLoopsClike(code));
  }

  function functionCosts(code, language) {
    const fns = language === "python" ? findPythonFunctions(code) : findClikeFunctions(code);
    let best = copy(ONE);
    const notes = [];
    for (const fn of fns) {
      let inner = add(loopCostFor(fn.body, language), extraOpCost(fn.body));
      for (const other of fns) {
        if (other.name === fn.name) continue;
        if (callCount(other.name, fn.body) > 0) {
          inner = add(inner, add(loopCostFor(other.body, language), extraOpCost(other.body)));
        }
      }
      const rec = recursionCost(fn, inner);
      if (callCount(fn.name, fn.body) > 0) {
        notes.push({ name: fn.name, calls: callCount(fn.name, fn.body), cost: rec });
      }
      best = add(best, rec);
    }
    return { cost: best, notes };
  }

  function patternsFor(code, language, loop, recNotes) {
    const patterns = [];
    if (loop.n >= 3) patterns.push("Triply nested loops");
    else if (loop.n === 2) patterns.push("Nested loops");
    else if (loop.n === 1 && loop.log === 0) patterns.push("Single pass");
    if (loop.log && loop.n === 0) patterns.push("Halving loop");
    if (loop.n >= 1 && loop.log >= 1) patterns.push("Linearithmic work");
    if (/\b(sorted\s*\(|\.sort\s*\(|Arrays\.sort|Collections\.sort|std::sort)/.test(code)) {
      patterns.push("Comparison sort");
    }
    if (/\b(bisect|binary_search|lower_bound|upper_bound|\bmid\b)/.test(code) && loop.log) {
      patterns.push("Binary search");
    }
    if (detectHash(code)) patterns.push("Hash map / set");
    if (detectGraph(code)) patterns.push("Graph traversal");
    if (detectQuicksort(code)) patterns.push("Quicksort");
    if (recNotes.some((n) => n.calls >= 2 && formatCost(n.cost).ascii.includes("2^n"))) {
      patterns.push("Branching recursion");
    } else if (recNotes.some((n) => n.calls >= 1)) {
      patterns.push("Recursion");
    }
    if (/@cache|@lru_cache|\bdp\s*[\[{]|memo/.test(code)) patterns.push("Memoization / DP");
    if (language && language !== "unknown") patterns.push(language);
    return unique(patterns);
  }

  function unique(arr) {
    return arr.filter((x, i) => arr.indexOf(x) === i);
  }

  function explain({ loop, extra, rec, total, patterns, hash, quicksort, graph }) {
    const bits = [];
    const loopFmt = formatCost(loop).pretty;
    if (!isOne(loop)) {
      if (loop.n >= 2) bits.push(`Nested iteration reaches ${loopFmt}.`);
      else if (loop.log && !loop.n) bits.push("A loop halves the search space each step, which is logarithmic.");
      else bits.push(`The dominant loop structure is ${loopFmt}.`);
    }
    if (!isOne(extra) && extraOpCost) {
      if (extra.log && extra.n) bits.push("A sort or heap pass adds an n log n factor.");
      else if (extra.log) bits.push("Binary search or heap operations contribute a log factor.");
    }
    if (rec.notes.length) {
      const exp = rec.notes.find((n) => n.cost.exp);
      if (exp) {
        bits.push(
          `${exp.name}() calls itself more than once per input size, so the recurrence is exponential without memoization.`
        );
      } else if (rec.notes.some((n) => n.cost.log && n.cost.n)) {
        bits.push("Divide-and-conquer recursion with linear work per level is n log n.");
      } else {
        bits.push("Recursive calls follow the input size down to a base case.");
      }
    }
    if (graph) bits.push("Adjacency plus BFS/DFS-style visitation is linear in vertices and edges.");
    if (hash) bits.push("Hash lookups are expected constant time, but degrade to linear per op in the worst case.");
    if (quicksort) bits.push("Quicksort is n log n on typical pivots and quadratic on a pathological partition.");
    if (!bits.length) bits.push("Straight-line work with no input-sized loops or recursion is constant time.");
    bits.push(`Overall bound: ${formatCost(total).pretty}.`);
    return bits.join(" ");
  }

  function boundsFrom({ total, hash, quicksort }) {
    const main = formatCost(total);
    let best = main;
    let average = main;
    let worst = main;
    let differ = false;

    if (hash && total.n >= 1 && !total.exp && !total.fact && total.n < 3) {
      worst = formatCost({ n: Math.max(total.n + 1, 2), log: total.log, exp: 0, fact: false, graph: false });
      differ = worst.ascii !== average.ascii;
    }
    if (quicksort) {
      best = formatCost(NLOG);
      average = formatCost(NLOG);
      worst = formatCost(N2);
      differ = true;
    }
    return { best, average, worst, differ, primary: average };
  }

  function analyzeBody(code, meta) {
    const language = meta.language && meta.language !== "unknown" ? meta.language : detectLanguage(code);
    const clean = stripNoise(code, language);
    const loop = loopCostFor(clean, language);
    const extra = extraOpCost(clean);
    const rec = functionCosts(clean, language);
    const graph = detectGraph(clean);
    const hash = detectHash(clean);
    const quicksort = detectQuicksort(clean);

    let total = add(add(loop, extra), rec.cost);
    if (graph) total = add(total, GRAPH);
    if (quicksort) total = add(total, NLOG);

    const patterns = patternsFor(clean, language, loop, rec.notes);
    const bound = boundsFrom({ total, hash, quicksort });
    const explanation = explain({
      loop,
      extra,
      rec,
      total,
      patterns,
      hash,
      quicksort,
      graph,
    });

    return {
      status: "ok",
      language,
      best: bound.best.pretty,
      average: bound.average.pretty,
      worst: bound.worst.pretty,
      bestAscii: bound.best.ascii,
      averageAscii: bound.average.ascii,
      worstAscii: bound.worst.ascii,
      primary: bound.primary.pretty,
      primaryAscii: bound.primary.ascii,
      differ: bound.differ,
      explanation,
      patterns: patterns.filter((p) => p !== language),
      confidence: rec.notes.length || loop.n >= 1 || graph ? "medium" : "low",
      engine: "local",
    };
  }

  function analyze(code, meta) {
    meta = meta || {};
    const trimmed = String(code || "").trim();
    if (!trimmed) {
      return {
        status: "empty",
        message: "There's no code on this page to analyze.",
        engine: "local",
      };
    }
    if (!looksLikeCode(trimmed)) {
      return {
        status: "no_code",
        message: "Nothing here looks like code. Open a solution editor or a snippet, then try again.",
        engine: "local",
      };
    }
    try {
      const result = analyzeBody(trimmed, meta);
      result.source = meta.source || "";
      result.codePreview = trimmed.slice(0, 4000);
      return result;
    } catch (err) {
      return {
        status: "failure",
        message:
          "Bound couldn't finish this analysis. The snippet may be incomplete or too unusual for the on-device checker.",
        detail: String(err && err.message ? err.message : err),
        engine: "local",
      };
    }
  }

  return {
    analyze,
    looksLikeCode,
    detectLanguage,
    stripNoise,
    formatCost,
    ONE,
    N,
    LOG,
  };
});
