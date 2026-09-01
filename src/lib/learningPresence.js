import { supabase } from './supabase.js'
import { normalizeLearningPresenceContext } from './learningPresenceContext.js'

const PING_MS = 150_000
const jitter = () => PING_MS * (0.85 + Math.random() * 0.3)

let enabled = false
let timer = null
let context = {}
let lastKey = ''
let bound = false

function stateNow() {
  return document.visibilityState === 'visible' ? 'active' : 'away'
}

async function ping(state, force = false) {
  if (!enabled) return
  const key = `${state}:${JSON.stringify(context)}`
  if (!force && key === lastKey && state !== 'active') return
  lastKey = key
  await supabase.rpc('rpc_learning_presence_ping', {
    p_state: state,
    p_context: context,
  })
}

function schedule() {
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(async () => {
    await ping(stateNow(), true)
    if (enabled) schedule()
  }, jitter())
}

function bindLifecycle() {
  if (bound) return
  document.addEventListener('visibilitychange', () => {
    if (enabled) ping(stateNow(), true)
  })
  window.addEventListener('pagehide', () => {
    if (enabled) ping('away', true)
  })
  bound = true
}

export function startLearningPresence(value) {
  context = normalizeLearningPresenceContext(value)
  enabled = true
  bindLifecycle()
  ping(stateNow(), true)
  schedule()
}

export function updateLearningPresence(value) {
  const next = normalizeLearningPresenceContext(value)
  if (JSON.stringify(next) === JSON.stringify(context)) return
  context = next
  if (enabled) ping(stateNow(), true)
}

export function stopLearningPresence() {
  if (!enabled) return
  ping('away', true)
  enabled = false
  lastKey = ''
  if (timer) window.clearTimeout(timer)
  timer = null
}

export const isLearningPresenceOn = () => enabled
