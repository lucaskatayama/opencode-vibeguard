import { createHmac, randomBytes } from "node:crypto"
import { sanitizeCategory, parseDurationMs } from "./utils.js"

function toHexLower(buffer) {
  return Buffer.from(buffer).toString("hex")
}

export class PlaceholderSession {
  constructor(options) {
    const prefix = String(options?.prefix ?? "__VG_")
    this.prefix = prefix
    this.ttlMs = parseDurationMs(options?.ttlMs, 3600000)
    this.maxMappings = Number.isFinite(options?.maxMappings) ? Number(options.maxMappings) : 100000
    this.secret = options?.secret ? Uint8Array.from(options.secret) : randomBytes(32)

    this.forward = new Map()
    this.reverse = new Map()
    this.created = new Map()
  }

  cleanup(now = Date.now()) {
    if (!Number.isFinite(this.ttlMs) || this.ttlMs <= 0) return
    for (const [placeholder, createdAt] of this.created.entries()) {
      if (now - createdAt <= this.ttlMs) continue
      const original = this.forward.get(placeholder)
      this.forward.delete(placeholder)
      this.created.delete(placeholder)
      if (original !== undefined) this.reverse.delete(original)
    }
  }

  evictOldest() {
    let oldestPlaceholder = ""
    let oldestTime = Infinity
    for (const [placeholder, createdAt] of this.created.entries()) {
      if (createdAt >= oldestTime) continue
      oldestTime = createdAt
      oldestPlaceholder = placeholder
    }
    if (!oldestPlaceholder) return
    const original = this.forward.get(oldestPlaceholder)
    this.forward.delete(oldestPlaceholder)
    this.created.delete(oldestPlaceholder)
    if (original !== undefined) this.reverse.delete(original)
  }

  lookup(placeholder) {
    return this.forward.get(placeholder)
  }

  lookupReverse(original) {
    return this.reverse.get(original)
  }

  generatePlaceholder(original, category) {
    const cat = sanitizeCategory(category)
    const h = createHmac("sha256", this.secret)
    h.update(String(original))
    const sum = h.digest()
    const hash12 = toHexLower(sum).slice(0, 12)
    return `${this.prefix}${cat}_${hash12}__`
  }

  getOrCreatePlaceholder(original, category) {
    const existing = this.lookupReverse(original)
    if (existing) return existing

    const now = Date.now()
    this.cleanup(now)

    if (Number.isFinite(this.maxMappings) && this.maxMappings > 0) {
      while (this.forward.size >= this.maxMappings) this.evictOldest()
    }

    const base = this.generatePlaceholder(original, category)
    const current = this.forward.get(base)
    if (current === undefined) {
      this.forward.set(base, original)
      this.reverse.set(original, base)
      this.created.set(base, now)
      return base
    }

    if (current === original) {
      this.reverse.set(original, base)
      this.created.set(base, now)
      return base
    }

    const withoutSuffix = base.slice(0, -2)
    for (let i = 2; ; i++) {
      const candidate = `${withoutSuffix}_${i}__`
      const prev = this.forward.get(candidate)
      if (prev === undefined) {
        this.forward.set(candidate, original)
        this.reverse.set(original, candidate)
        this.created.set(candidate, now)
        return candidate
      }
      if (prev === original) {
        this.reverse.set(original, candidate)
        this.created.set(candidate, now)
        return candidate
      }
    }
  }
}

export function getPlaceholderRegex(prefix) {
  const escaped = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`${escaped}[A-Za-z0-9_]+_[a-f0-9A-F]{12}(?:_\\d+)?__`, "g")
}