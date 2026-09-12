const assert = require("assert");
const analyzer = require("../analyzer.js");

function ascii(code) {
  const r = analyzer.analyze(code);
  assert.strictEqual(r.status, "ok", r.message || JSON.stringify(r));
  return r.primaryAscii || r.averageAscii;
}

function allAscii(code) {
  const r = analyzer.analyze(code);
  assert.strictEqual(r.status, "ok", r.message || JSON.stringify(r));
  return { best: r.bestAscii, average: r.averageAscii, worst: r.worstAscii, differ: r.differ, r };
}

{
  const r = analyzer.analyze("");
  assert.strictEqual(r.status, "empty");
  assert.match(r.message, /no code on this page/i);
}

{
  const r = analyzer.analyze("   \n\t  ");
  assert.strictEqual(r.status, "empty");
}

{
  const r = analyzer.analyze(
    "The problem asks you to return the two numbers that add up to the target. You may assume each input has exactly one solution."
  );
  assert.strictEqual(r.status, "no_code");
  assert.match(r.message, /looks like code/i);
}

{
  const r = analyzer.analyze("x = 3\ny = 4\nreturn x + y");
  assert.strictEqual(r.status, "ok");
  assert.strictEqual(ascii("x = 3\ny = 4\nreturn x + y"), "O(1)");
}

{
  const code = `def sum_arr(a):\n    total = 0\n    for x in a:\n        total += x\n    return total`;
  assert.strictEqual(ascii(code), "O(n)");
}

{
  const code = `def two_sum_brute(nums, target):\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]\n    return []`;
  assert.strictEqual(ascii(code), "O(n^2)");
}

{
  const code = `def cube(grid):\n    n = len(grid)\n    for i in range(n):\n        for j in range(n):\n            for k in range(n):\n                grid[i][j] += k\n    return grid`;
  assert.strictEqual(ascii(code), "O(n^3)");
}

{
  const code = `int nested(int n) {
  int s = 0;
  for (int i = 0; i < n; i++) {
    for (int j = 0; j < n; j++) {
      s += i + j;
    }
  }
  return s;
}`;
  assert.strictEqual(ascii(code), "O(n^2)");
}

{
  const code = `def search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1`;
  assert.strictEqual(ascii(code), "O(log n)");
}

{
  const code = `def walk(n):\n    i = 1\n    while i < n:\n        i *= 2\n    return i`;
  assert.strictEqual(ascii(code), "O(log n)");
}

{
  const code = `def merge(a, b):\n    out = []\n    i = j = 0\n    while i < len(a) and j < len(b):\n        if a[i] < b[j]:\n            out.append(a[i]); i += 1\n        else:\n            out.append(b[j]); j += 1\n    return out + a[i:] + b[j:]\n\ndef merge_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    mid = len(arr) // 2\n    return merge(merge_sort(arr[:mid]), merge_sort(arr[mid:]))`;
  assert.strictEqual(ascii(code), "O(n log n)");
}

{
  const code = `def fib(n):\n    if n <= 1:\n        return n\n    return fib(n - 1) + fib(n - 2)`;
  assert.strictEqual(ascii(code), "O(2^n)");
}

{
  const code = `from functools import cache\n@cache\ndef fib(n):\n    if n <= 1:\n        return n\n    return fib(n - 1) + fib(n - 2)`;
  assert.strictEqual(ascii(code), "O(n)");
}

{
  const code = `def twoSum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n    return []`;
  const b = allAscii(code);
  assert.strictEqual(b.average, "O(n)");
  assert.strictEqual(b.worst, "O(n^2)");
  assert.strictEqual(b.differ, true);
}

{
  const code = `void sortIt(int[] a) {\n  Arrays.sort(a);\n}`;
  assert.strictEqual(ascii(code), "O(n log n)");
}

{
  const code = `function bfs(graph, start) {
  const visited = new Set();
  const queue = [start];
  visited.add(start);
  while (queue.length) {
    const u = queue.shift();
    for (const v of graph[u] || []) {
      if (!visited.has(v)) {
        visited.add(v);
        queue.push(v);
      }
    }
  }
}`;
  assert.strictEqual(ascii(code), "O(V + E)");
}

{
  const code = `def sequential(a):\n    s = 0\n    for x in a:\n        s += x\n    for y in a:\n        s += y\n    return s`;
  assert.strictEqual(ascii(code), "O(n)");
}

{
  const code = `function linear(n) {\n  let s = 0;\n  for (let i = 0; i < n; i++) s += i;\n  return s;\n}`;
  assert.strictEqual(ascii(code), "O(n)");
}

{
  const code = `def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)`;
  assert.strictEqual(ascii(code), "O(n)");
}

{
  const code = `def constant_inner(n):\n    total = 0\n    for i in range(n):\n        for j in range(3):\n            total += j\n    return total`;
  assert.strictEqual(ascii(code), "O(n)");
}

{
  const r = analyzer.analyze("print(1)");
  assert.ok(r.status === "ok" || r.status === "no_code");
}

{
  const code = `def dfs(node):\n    if not node:\n        return 0\n    return 1 + dfs(node.left) + dfs(node.right)`;
  assert.strictEqual(ascii(code), "O(n)");
}

console.log("All analyzer tests passed.");
