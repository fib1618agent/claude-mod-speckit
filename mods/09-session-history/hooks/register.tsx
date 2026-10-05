import type { Register } from 'claude-code'
import type { HistoryEntry } from '../types'
import { projectKey } from './shared/fingerprint'
import { parseConfig, section, bool, int } from './shared/config'
import { DEFAULT_MAX, appendBounded, diffSnapshot, formatTimeline, type Sig, type Snapshot } from './lib/history'

const HISTORY = { plugin: 'sdd-session-history', key: 'history' } as const
const CAPABILITY = { plugin: 'sdd-session-history', key: 'capability' } as const
const PHASE = { plugin: 'sdd-phase-tracker', key: 'phase' } as const
const PROMPT_RES = { plugin: 'sdd-prompt-manager', key: 'promptResolution' } as const
const REVIEW = { plugin: 'sdd-prompt-review', key: 'review' } as const
const ANALYZE = { plugin: 'sdd-analyze-gate', key: 'analyze' } as const
const ARTIFACTS = { plugin: 'sdd-artifact-tracker', key: 'artifacts' } as const
const QUALITY = { plugin: 'sdd-quality-gate', key: 'quality' } as const
const TRACE = { plugin: 'sdd-traceability', key: 'trace' } as const
const CONVERGENCE = { plugin: 'sdd-convergence-tracker', key: 'convergence' } as const
const NAV_VIEW = { plugin: 'sdd-navigator', key: 'view' } as const

let entries: HistoryEntry[] = []
let sig: Sig = {}
let loaded = false

async function settings($: any): Promise<{ enabled: boolean; max: number; key: string }> {
  const root: string = await $.session.root()
  let text = ''
  try { const p = `${root}/.speckit/mod/config.yaml`; if (await $.fs.exists(p)) text = String(await $.fs.read(p)) } catch { /* no config */ }
  const h = section(parseConfig(text), 'history')
  return { enabled: bool(h.enabled, true), max: int(h.maxEntries, DEFAULT_MAX), key: 'history:' + projectKey(root) }
}

async function snapshot($: any): Promise<Snapshot> {
  const phase = (await $.state.get(PHASE)).value
  const pr = (await $.state.get(PROMPT_RES)).value
  const review = (await $.state.get(REVIEW)).value
  const analyze = (await $.state.get(ANALYZE)).value
  const art = (await $.state.get(ARTIFACTS)).value
  const quality = (await $.state.get(QUALITY)).value
  const trace = (await $.state.get(TRACE)).value
  const conv = (await $.state.get(CONVERGENCE)).value
  return {
    phase: phase ? { current: phase.current } : undefined,
    promptRes: pr ? { phase: pr.phase, templateId: pr.templateId, version: pr.version, status: pr.status } : undefined,
    review: review ? { phase: review.phase, state: review.state, promptHash: review.promptHash, requestId: review.requestId, edited: review.edited, reason: review.reason } : undefined,
    analyze: analyze ? { at: analyze.at, overall: analyze.overall, counts: analyze.countsBySeverity } : undefined,
    artifacts: art ? Object.fromEntries(art.items.filter((i: any) => i.exists).map((i: any) => [i.id, i.hash])) : undefined,
    quality: quality ? Object.fromEntries(Object.values(quality.gates).map((x: any) => [x.phase, x.display])) : undefined,
    trace: trace ? { status: trace.status, gaps: trace.gaps.length } : undefined,
    convergence: conv ? { state: conv.state } : undefined,
  }
}

// ONE observation path, used by every state.set hook AND by turn.complete (the re-derive fallback): both diff the same snapshot.
async function observe($: any): Promise<void> {
  const set = await settings($)
  if (!set.enabled) return
  if (!loaded) { entries = ((await $.store.get(set.key)) as HistoryEntry[] | undefined) ?? []; loaded = true }
  let sessionId: string | undefined
  try { sessionId = await $.session.id() } catch { sessionId = undefined }
  const out = diffSnapshot(sig, await snapshot($), await $.clock.now(), sessionId)
  sig = out.sig
  if (out.entries.length) {
    entries = appendBounded(entries, out.entries, set.max)
    await $.store.set(set.key, entries)
  }
  await $.state.set(HISTORY, { entries, at: await $.clock.now() })
}

async function confirm($: any, question: string): Promise<boolean> {
  try { return (await $.ui.ask(question, ['Yes', 'No'])) === 'Yes' } catch { return false }
}

async function clearHistory($: any): Promise<string> {
  const set = await settings($)
  if (!(await confirm($, 'Clear the SDD history for THIS project?'))) return 'Not cleared (no confirmation).'
  entries = []
  await $.store.delete(set.key)
  await $.state.set(HISTORY, { entries, at: await $.clock.now() })
  return 'SDD history cleared for this project.'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sdd-history', description: 'Show the SDD action history', argumentHint: '[phase <phase> | last | clear]' })
    await $.state.set(CAPABILITY, { id: 'history', version: '0.1.0', status: 'ready' })
    await observe($) // baseline: transitions are recorded, not the state found at startup
    return next(e)
  })

  on('command.run', { command: 'sdd-history' }, async ($, e) => {
    const [sub = '', arg = ''] = (e.args ?? '').trim().split(/\s+/)
    if (sub === 'clear') return { text: await clearHistory($) }
    await observe($)
    if (sub === 'phase' && arg) return { text: formatTimeline(entries, { phase: arg }) }
    return { text: formatTimeline(entries, { last: sub === 'last' }) }
  })

  on('state.set', { plugin: 'sdd-phase-tracker', key: 'phase' }, async ($, e, next) => { const r = await next(e); await observe($); return r })
  on('state.set', { plugin: 'sdd-prompt-manager', key: 'promptResolution' }, async ($, e, next) => { const r = await next(e); await observe($); return r })
  on('state.set', { plugin: 'sdd-prompt-review', key: 'review' }, async ($, e, next) => { const r = await next(e); await observe($); return r })
  on('state.set', { plugin: 'sdd-analyze-gate', key: 'analyze' }, async ($, e, next) => { const r = await next(e); await observe($); return r })
  on('state.set', { plugin: 'sdd-artifact-tracker', key: 'artifacts' }, async ($, e, next) => { const r = await next(e); await observe($); return r })
  on('state.set', { plugin: 'sdd-quality-gate', key: 'quality' }, async ($, e, next) => { const r = await next(e); await observe($); return r })
  on('state.set', { plugin: 'sdd-traceability', key: 'trace' }, async ($, e, next) => { const r = await next(e); await observe($); return r })
  on('state.set', { plugin: 'sdd-convergence-tracker', key: 'convergence' }, async ($, e, next) => { const r = await next(e); await observe($); return r })
  on('turn.complete', async ($, e, next) => { await observe($); return next(e) })

  on('ui.render', { component: 'Pane', requestId: ['sdd', 'sdd-view'] }, async ($, e, next) => {
    const nav = (await $.state.get(NAV_VIEW)).value
    if (nav?.activeView !== 'history' || (e.requestId === 'sdd' && nav.mode === 'panes')) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const h = (await $.state.get(HISTORY)).value
    return (
      <Box flexDirection="column">
        <Text bold>SDD / HISTORY</Text>
        {formatTimeline(h?.entries ?? []).split('\n').map((l, n) => <Text key={String(n)}>{l}</Text>)}
        <Button key="history-clear" label="Clear" hotkey="x" onPress={async () => { $.ui.toast(await clearHistory($)) }} />
      </Box>
    )
  })
}
