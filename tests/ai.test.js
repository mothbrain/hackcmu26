const assert = require("assert");
const ai = require("../ai.js");

assert.strictEqual(ai.normalizeBound("O(n^2)"), "O(n²)");
assert.strictEqual(ai.normalizeBound("n log n"), "O(n log n)");
assert.strictEqual(ai.normalizeBound("O(2^n)"), "O(2ⁿ)");
assert.strictEqual(ai.DEFAULT_MODEL, "gpt-4o-mini");
assert.strictEqual(ai.DEFAULT_BASE, "https://api.openai.com/v1");

console.log("All AI helper tests passed.");
