import { sanitizeCategory } from "./utils.js"

function peelInlineFlags(pattern, flags) {
  let p = String(pattern ?? "")
  let f = String(flags ?? "")

  for (;;) {
    if (p.startsWith("(?i)")) {
      p = p.slice(4)
      if (!f.includes("i")) f += "i"
      continue
    }
    if (p.startsWith("(?m)")) {
      p = p.slice(4)
      if (!f.includes("m")) f += "m"
      continue
    }
    break
  }

  return { pattern: p, flags: f }
}

const BUILTIN = new Map([
  ["email", { pattern: "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}", flags: "i", category: "EMAIL" }],
  ["china_phone", { pattern: "(?<!\d)1[3-9]\\d{9}(?!\d)", flags: "", category: "CHINA_PHONE" }],
  ["china_id", { pattern: "(?<!\d)\\d{17}[\\dXx](?!\d)", flags: "", category: "CHINA_ID" }],
  ["uuid", { pattern: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}", flags: "", category: "UUID" }],
  ["ipv4", { pattern: "(?:\\d{1,3}\\.){3}\\d{1,3}", flags: "", category: "IPV4" }],
  ["mac", { pattern: "(?:[0-9a-f]{2}:){5}[0-9a-f]{2}", flags: "i", category: "MAC" }],
  ["uri_credentials", { pattern: "(?<=://)[^:@]+:[^@]+(?=@)", flags: "i", category: "URI_CREDENTIALS" }],
  ["env_secret", { pattern: "(?<![A-Za-z0-9])[A-Za-z_][A-Za-z0-9_]*SECRET=\\S+", flags: "i", category: "ENV_SECRET" }],
  ["env_key", { pattern: "(?<![A-Za-z0-9])[A-Za-z_][A-Za-z0-9_]*KEY=\\S+", flags: "i", category: "ENV_KEY" }],
])

export function buildPatternSet(patterns) {
  const raw = patterns && typeof patterns === "object" ? patterns : {}

  const keywords = Array.isArray(raw.keywords) ? raw.keywords : []
  const regex = Array.isArray(raw.regex) ? raw.regex : []
  const builtin = Array.isArray(raw.builtin) ? raw.builtin : []
  const exclude = Array.isArray(raw.exclude) ? raw.exclude : []

  const keywordRules = keywords
    .map((x) => {
      if (!x || typeof x !== "object") return null
      const value = String(x.value ?? "").trim()
      if (!value) return null
      return { value, category: sanitizeCategory(x.category) }
    })
    .filter(Boolean)

  const regexRules = []
  for (const x of regex) {
    if (!x || typeof x !== "object") continue
    const pattern = String(x.pattern ?? "").trim()
    if (!pattern) continue
    const peeled = peelInlineFlags(pattern, typeof x.flags === "string" ? x.flags : "")
    regexRules.push({ pattern: peeled.pattern, flags: peeled.flags, category: sanitizeCategory(x.category) })
  }

  for (const name of builtin) {
    const key = String(name ?? "").trim()
    if (!key) continue
    const rule = BUILTIN.get(key)
    if (!rule) continue
    regexRules.push({ pattern: rule.pattern, flags: rule.flags, category: rule.category })
  }

  return {
    keywords: keywordRules,
    regex: regexRules,
    exclude: new Set(exclude.map((x) => String(x ?? ""))),
  }
}