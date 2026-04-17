export function sanitizeCategory(input) {
  const raw = String(input ?? "").trim()
  if (!raw) return "TEXT"
  const upper = raw.toUpperCase()
  const safe = upper.replace(/[^A-Z0-9_]/g, "_").replace(/_+/g, "_")
  return safe || "TEXT"
}

export const UNITS = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }

export function parseDurationMs(input, def = 3600000) {
  const raw = String(input ?? "").trim() || "1h"
  const m = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/)
  if (!m) return def
  const value = Number(m[1])
  const mult = UNITS[m[2]]
  return Number.isFinite(value) && value >= 0 ? value * mult : def
}

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function walk(obj, handler, ctx) {
  const seen = new WeakSet()

  const _walk = (node) => {
    if (!node || typeof node !== "object") return
    if (seen.has(node)) return
    seen.add(node)

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const v = node[i]
        if (typeof v === "string") handler.call(ctx, node, i, v)
        else if (v && typeof v === "object") _walk(v)
      }
      return
    }

    if (!isPlainObject(node)) return

    for (const key of Object.keys(node)) {
      const v = node[key]
      if (typeof v === "string") handler.call(ctx, node, key, v)
      else if (v && typeof v === "object") _walk(v)
    }
  }

  _walk(obj)
}