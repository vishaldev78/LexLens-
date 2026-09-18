#!/usr/bin/env node
// Codemod: reduce LexLens to EN + HI (PRD §2).
// 1. In rules.ts (and any other file): rewrite l4(en, hi, zh, fr) → l4(en, hi).
// 2. Report any leftover 4-key L4 object literals for manual follow-up.
// Run: node scripts/codemod-en-hi.mjs
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
let src = readFileSync(file, "utf8");

/** Parse a balanced parenthesised argument list starting at `open` index. */
function findArgSpan(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split top-level commas of the inner arg string, respecting quotes. */
function splitArgs(inner) {
  const args = [];
  let depth = 0, cur = "", inStr = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) {
      cur += ch;
      if (ch === "\\") { cur += inner[++i] ?? ""; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; cur += ch; continue; }
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    if (ch === ")" || ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 0) { args.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) args.push(cur);
  return args;
}

let count = 0;
const out = [];
let i = 0;
while (i < src.length) {
  const idx = src.indexOf("l4(", i);
  if (idx === -1) { out.push(src.slice(i)); break; }
  // must be a bare identifier l4 (not .l4 / xl4)
  const prev = idx > 0 ? src[idx - 1] : "";
  if (/[A-Za-z0-9_.$]/.test(prev)) { out.push(src.slice(i, idx + 3)); i = idx + 3; continue; }
  const close = findArgSpan(src, idx + 2);
  if (close === -1) { out.push(src.slice(i)); break; }
  const inner = src.slice(idx + 3, close);
  const args = splitArgs(inner);
  out.push(src.slice(i, idx + 3));
  if (args.length >= 4) {
    // keep only first two (en, hi)
    out.push(`${args[0].trim()}, ${args[1].trim()}`);
    count++;
  } else {
    out.push(inner);
  }
  out.push(")");
  i = close + 1;
}

writeFileSync(file, out.join(""));
console.log(`${file}: rewrote ${count} l4() calls to (en, hi)`);
