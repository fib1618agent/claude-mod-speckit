import type { PluginState } from 'claude-code'
import type { Phase, PhaseEntry } from '../../types'

type Artifacts = PluginState['sdd-artifact-tracker']['artifacts']

// Which 05 artifact is the evidence for a phase. Phases without an artifact of their own (clarify, analyze, converge, ...)
// have NO evidence source in 01's allowed inputs, so they are reported `unknown` rather than guessed.
export const PHASE_ARTIFACT: Record<string, string> = {
  constitution: 'constitution', specify: 'spec', plan: 'plan', checklist: 'checklist', tasks: 'tasks', implement: 'implementation',
}

export function derivePhase(model: string[], inv: Artifacts | undefined, at: number): Phase {
  if (!inv) return { current: null, next: null, phases: model.map(id => ({ id, status: 'unknown', evidence: [] })), at, reason: 'no artifact inventory (Artifact Tracker unavailable)' }
  if (!inv.isSpecKit) return { current: null, next: null, phases: model.map(id => ({ id, status: 'unknown', evidence: [] })), at, reason: 'not a Spec-Kit project' }
  const byId = new Map(inv.items.map(i => [i.id, i]))
  const phases: PhaseEntry[] = model.map(id => {
    const art = PHASE_ARTIFACT[id]
    const item = art ? byId.get(art) : undefined
    if (!art || !item) return { id, status: 'unknown', evidence: [] }
    if (item.status === 'unreadable') return { id, status: 'unknown', evidence: [art] }
    if (!item.exists) return { id, status: 'pending', evidence: [] }
    if (item.fresh === 'stale') return { id, status: 'blocked', evidence: [art] } // upstream changed after it was produced
    return { id, status: item.fresh === 'fresh' ? 'complete' : 'unknown', evidence: [art] }
  })
  // current = first evidenced phase that is not complete; otherwise the first phase after the last complete one.
  let idx = phases.findIndex(p => p.status === 'pending' || p.status === 'blocked')
  if (idx < 0) {
    const lastDone = phases.map(p => p.status).lastIndexOf('complete')
    idx = phases.findIndex((p, i) => i > lastDone && p.status === 'unknown')
  }
  const cur = phases[idx]
  if (cur && cur.status !== 'blocked') cur.status = 'current'
  return { current: cur ? cur.id : null, next: idx >= 0 ? (phases[idx + 1]?.id ?? null) : null, phases, at }
}

export function formatPhase(p: Phase): string {
  if (p.reason) return `Phase: unknown (${p.reason})`
  const mark: Record<string, string> = { complete: '[x]', current: '[>]', pending: '[ ]', blocked: '[!]', failed: '[X]', unknown: '[?]' }
  const rows = p.phases.map(e => `${mark[e.status]} ${e.id.padEnd(14)} ${e.status}${e.evidence.length ? '  (' + e.evidence.join(',') + ')' : ''}`)
  const done = p.phases.filter(e => e.status === 'complete').length
  return `Current: ${p.current ?? 'none'}   Next: ${p.next ?? 'none'}   Progress: ${done}/${p.phases.length}\n${rows.join('\n')}`
}
