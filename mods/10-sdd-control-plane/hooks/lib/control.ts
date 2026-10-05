import type { PluginState } from 'claude-code'
import type { Control, NextAction } from '../../types'
import { evidenceFreshness } from '../shared/evidence'

type S = PluginState
export type ControlInput = {
  phase: S['sdd-phase-tracker']['phase'] | undefined
  review: S['sdd-prompt-review']['review'] | undefined
  analyze: S['sdd-analyze-gate']['analyze'] | undefined
  artifacts: S['sdd-artifact-tracker']['artifacts'] | undefined
  quality: S['sdd-quality-gate']['quality'] | undefined
  trace: S['sdd-traceability']['trace'] | undefined
  convergence: S['sdd-convergence-tracker']['convergence'] | undefined
  history: S['sdd-session-history']['history'] | undefined
  at: number
}

export const KNOWN_SECTIONS = ['phase', 'prompt', 'review', 'analyze', 'artifacts', 'quality', 'trace', 'convergence', 'history', 'control', 'navigator']

// nextAction: a PURE function of other Mods' state. It is a recommendation naming an owner; 10 never executes it.
export function deriveNext(i: ControlInput): NextAction {
  if (i.review?.state === 'pending') return { text: `Review the pending "${i.review.phase}" prompt (③ Review).`, owner: '03 Prompt Review Gate', viewId: 'review' }
  const cur = i.phase?.current ?? undefined
  const gate = cur ? i.quality?.gates[cur] : undefined
  if (gate && gate.blockers.some(b => /Analyze/.test(b))) return { text: 'Analyze is missing or stale: request it through the Review Gate (/sdd-run analyze).', owner: '04 Analyze Gate', viewId: 'analyze' }
  if (gate && (gate.status === 'BLOCKED' || gate.status === 'NOT_READY')) return { text: `Resolve the "${cur}" gate blockers: ${gate.blockers.slice(0, 2).join('; ')} (⑥ Quality).`, owner: '06 Quality Gate', viewId: 'quality' }
  if (i.trace?.status === 'GAPS') return { text: `Review ${i.trace.gaps.length} traceability gap(s) (⑦ Trace).`, owner: '07 Traceability', viewId: 'trace' }
  if (i.convergence?.state === 'REGRESSED') return { text: 'Convergence regressed: review it (⑧ Converge).', owner: '08 Convergence Tracker', viewId: 'converge' }
  const entry = i.phase?.phases.find(p => p.id === cur)
  if (cur && entry && (entry.status === 'current' || entry.status === 'blocked')) return { text: `Run the "${cur}" phase through the Review Gate (/sdd-run ${cur}).`, owner: '03 Prompt Review Gate', viewId: 'review' }
  if (i.phase?.next) return { text: `Start the next phase "${i.phase.next}" through the Review Gate (/sdd-run ${i.phase.next}).`, owner: '03 Prompt Review Gate', viewId: 'review' }
  return { text: 'Nothing pending: no phase is waiting.', owner: '01 Phase Tracker', viewId: 'phase' }
}

export function deriveControl(i: ControlInput): Control {
  const done = i.phase?.phases.filter(p => p.status === 'complete').length ?? 0
  const total = i.phase?.phases.length ?? 0
  const items = i.artifacts?.items ?? []
  const cur = i.phase?.current ?? undefined
  const current = i.artifacts ? Object.fromEntries(items.filter(x => x.exists).map(x => [x.id, x.hash])) : undefined
  const fresh = i.analyze ? evidenceFreshness(i.analyze.artifactHashes, current) : undefined
  const last = i.history?.entries[i.history.entries.length - 1]
  return {
    at: i.at,
    nextAction: deriveNext(i),
    summary: {
      phase: cur ?? 'unknown',
      nextPhase: i.phase?.next ?? '-',
      progress: total ? `${done}/${total}` : '-',
      artifactHealth: i.artifacts ? `${items.filter(x => x.exists).length}/${items.length} present, ${items.filter(x => x.fresh === 'stale').length} stale` : 'unavailable',
      analyze: i.analyze ? `${i.analyze.overall}${fresh === 'stale' ? ' (stale)' : fresh === 'unknown' ? ' (staleness unknown)' : ''}` : 'none',
      traceability: i.trace ? `${i.trace.status}${i.trace.gaps.length ? `, ${i.trace.gaps.length} gap(s)` : ''}` : 'unavailable',
      quality: (cur && i.quality?.gates[cur]?.display) || (i.quality ? 'UNKNOWN' : 'unavailable'),
      convergence: i.convergence?.state ?? 'unavailable',
      lastAction: last ? last.summary : 'none',
    },
  }
}

// Aggregate wording; the status line in 00 reads the same summary.
export function formatControl(c: Control | undefined): string[] {
  if (!c) return ['No aggregate yet.']
  const s = c.summary
  return [
    `CURRENT PHASE    ${s.phase}`, `NEXT PHASE       ${s.nextPhase}`, `PHASE PROGRESS   ${s.progress}`, `ARTIFACT HEALTH  ${s.artifactHealth}`,
    `ANALYZE STATUS   ${s.analyze}`, `TRACEABILITY     ${s.traceability}`, `QUALITY GATE     ${s.quality}`, `CONVERGENCE      ${s.convergence}`,
    `LAST ACTION      ${s.lastAction}`, '', `NEXT ACTION      ${c.nextAction.text}`, `                 (owner: ${c.nextAction.owner})`,
  ]
}

// Validation is DELEGATED: this only checks structure the file format itself needs; each Mod validates its own section.
export function validateConfigDraft(text: string, parsed: Record<string, Record<string, string>>): string | undefined {
  const unknown = Object.keys(parsed).filter(k => !KNOWN_SECTIONS.includes(k))
  if (unknown.length) return `unknown section(s): ${unknown.join(', ')} (known: ${KNOWN_SECTIONS.join(', ')})`
  const topLevel = text.split('\n').filter(l => /^[A-Za-z]/.test(l) && !/^[A-Za-z][\w-]*:\s*$/.test(l.replace(/\s+#.*$/, '')))
  if (topLevel.length) return `top-level line is not a "section:" header: ${topLevel[0]!.slice(0, 40)}`
  return undefined
}
