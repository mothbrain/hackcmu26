# Bound

Chrome extension (Manifest V3) that estimates **Big-O time bounds** for the code currently on the page. Click the toolbar icon on LeetCode, HackerRank, GitHub, or any site that shows code in Monaco, CodeMirror, Ace, or a `pre`/`code` block.

It prefers an **on-device** checker so it works with no account. You can optionally hook it up to **ChatGPT (OpenAI)** or another OpenAI-compatible server for harder snippets.

## Load unpacked in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select this folder (the one that contains `manifest.json`).
5. Pin **Bound** from the puzzle-piece menu so the toolbar icon stays visible.

On a page with an editor, click the icon. Chrome may also offer **Alt+Shift+T** (macOS: **Option+Shift+T**) as the shortcut; set or confirm it under `chrome://extensions/shortcuts`.

Chrome blocks extensions on `chrome://` pages and the Web Store. Open a coding site first.

## What you get

- Best / average / worst time bounds when they actually differ (hash tables, quicksort). Otherwise one bound.
- A short explanation and the patterns Bound noticed (nested loops, recursion, binary search, and so on).
- Honest empty / no-code / failure copy when there is nothing to read or the checker cannot finish.

If you select a snippet first, Bound analyzes the selection. Otherwise it prefers the focused editor, then other editors, then visible `pre`/`code` blocks.

## Hook up ChatGPT or another model

The on-device engine needs no setup. To send extracted code to a model:

### OpenAI / ChatGPT

1. Create a secret key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Usage is billed to your OpenAI account.
2. Right-click the Bound icon → **Options**, or open Settings from the popup.
3. Set **Engine** to **OpenAI / ChatGPT**.
4. Paste the key. Bound stores it only in `chrome.storage.local` on this browser — it is never written into the repo and Bound has no backend.
5. Leave **Model** as `gpt-4o-mini` unless you want a different chat model.
6. Leave **API base URL** as `https://api.openai.com/v1`.
7. Save. The next toolbar click sends the extracted code to OpenAI `chat/completions` and shows that bound. If the request fails, Bound falls back to the on-device result and tells you why.

### Local or compatible servers (Ollama, Azure, proxies)

The same Settings fields speak any host that implements `POST {base}/chat/completions`.

Example: Ollama’s OpenAI-compatible endpoint

- Engine: OpenAI / ChatGPT / compatible API
- API base URL: `http://localhost:11434/v1`
- Model: `llama3.1` (or whatever you pulled)
- API key: blank, or `ollama`

Chrome will prompt you to allow access to that origin the first time you save. Code leaves your machine only if you point the base URL at a remote host.

## Develop

```bash
node tests/analyzer.test.js
```

`popup.html` also runs outside Chrome: serve this folder and open `/popup.html` to paste samples into the same UI. `sample.html` is a dummy LeetCode-style page you can point the loaded extension at.

```bash
python3 -m http.server 43147
```

## Privacy

- Default mode never sends code off the device.
- OpenAI mode sends only the extracted snippet to the base URL you configured, using the key you pasted.
- Bound does not include auth, a database, or any extra service of its own.
