import { walk } from "./utils.js"
import { restoreText } from "./restore.js"
import { redactText } from "./engine.js"

function restoreHandler(arr, key, val) {
  arr[key] = restoreText(val, this)
}

function redactHandler(arr, key, val) {
  arr[key] = redactText(val, this.patterns, this.session).text
}

export function restoreDeep(value, session) {
  if (!value || typeof value !== "object") return
  walk(value, restoreHandler, session)
}

export function redactDeep(value, patterns, session) {
  if (!value || typeof value !== "object") return
  walk(value, redactHandler, { patterns, session })
}