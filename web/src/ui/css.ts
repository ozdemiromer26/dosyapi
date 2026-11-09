import type { CSSProperties } from "react";

const cache = new Map<string, CSSProperties>();

/** Tasarımın CSS metnini React stil nesnesine çevirir (CSP uyumlu, CSSOM ile uygulanır). */
export function css(text: unknown): CSSProperties {
  const source = typeof text === "string" ? text : "";
  const hit = cache.get(source);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const part of splitDeclarations(source)) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    const name = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (!name || !value) continue;
    const key = name.startsWith("--") ? name : name.replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = value;
  }
  if (cache.size > 4000) cache.clear();
  cache.set(source, out as CSSProperties);
  return out as CSSProperties;
}

function splitDeclarations(source: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 0) {
      parts.push(source.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}
