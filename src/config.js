import { existsSync } from "node:fs"
import * as fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { parseDurationMs } from "./utils.js"

function readJson(filepath) {
  return fs
    .readFile(filepath, "utf8")
    .then((s) => JSON.parse(s))
    .catch(() => null)
}

function normalizeConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {}

  const enabled = Boolean(cfg.enabled)
  const debug = Boolean(cfg.debug)
  const prefix = typeof cfg.placeholder_prefix === "string" && cfg.placeholder_prefix ? cfg.placeholder_prefix : "__VG_"

  const session = cfg.session && typeof cfg.session === "object" ? cfg.session : {}
  const ttlMs = parseDurationMs(session.ttl ?? "1h")
  const maxMappings =
    Number.isFinite(session.max_mappings) && Number(session.max_mappings) > 0 ? Number(session.max_mappings) : 100000

  const patterns = cfg.patterns && typeof cfg.patterns === "object" ? cfg.patterns : {}

  return {
    enabled,
    debug,
    prefix,
    ttlMs,
    maxMappings,
    patterns,
  }
}

export function getConfigCandidates(directory) {
  const dir = String(directory ?? process.cwd())
  const home = os.homedir()
  const globalConfig = path.join(home, ".config", "opencode", "vibeguard.config.json")
  const projectRoot = path.join(dir, "vibeguard.config.json")
  const projectLocal = path.join(dir, ".opencode", "vibeguard.config.json")

  const env = process.env.OPENCODE_VIBEGUARD_CONFIG
  if (env) return [path.resolve(dir, env), projectRoot, projectLocal, globalConfig]

  return [projectRoot, projectLocal, globalConfig]
}

/**
 * 加载插件配置：
 * - 找不到配置或解析失败：返回 enabled=false（插件 no-op）
 * - 只做轻量校验，避免引入额外依赖
 */
export async function loadConfig(directory) {
  const candidates = getConfigCandidates(directory)
  for (const file of candidates) {
    if (!file) continue
    if (!existsSync(file)) continue
    const raw = await readJson(file)
    if (!raw) continue
    const cfg = normalizeConfig(raw)
    return { ...cfg, loadedFrom: file }
  }

  const defaultPath = path.join(process.cwd(), "vibeguard.config.default.json")
  if (existsSync(defaultPath)) {
    const raw = await readJson(defaultPath)
    if (raw) {
      const cfg = normalizeConfig(raw)
      return { ...cfg, loadedFrom: defaultPath, isDefault: true }
    }
  }

  const cfg = normalizeConfig({ enabled: false })
  return { ...cfg, loadedFrom: "" }
}
