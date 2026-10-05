import type { HistoryEntry } from '../../types'

// What the observer looks at: enumerated, bounded fields only. Never prompts, source text, secrets or findings' evidence.
export type Snapshot = {
  phase?: { current: string | null }
  promptRes?: { phase: string; templateId: string; version: string; status: string }
  review?: { phase: string; state: string; promptHash: string; requestId: string; edited?: boolean; reason?: string }
  analyze?: { at: number; overall: string; counts: Record<string, number> }
  artifacts?: Record<string, string> // id -> hash
  quality?: Record<string, string> // phase -> display
  trace?: { status: string; gaps: number }
  convergence?: { state: string }
}
export type Sig = Record<string, string>

export const DEFAULT_MAX = 200

export function diffSnapshot(prev: Sig, s: Snapshot, at: number, sessionId?: string): { entries: HistoryEntry[]; sig: Sig } {
  const sig: Sig = {}
  const entries: HistoryEntry[] = []
  const base = { at, ...(sessionId ? { sessionId } : {}) }
  const changed = (k: string, v: string) => { sig[k] = v; return prev[k] !== undefined && prev[k] !== v }
  const seed = (k: string, v: string) => { sig[k] = v; return prev[k] === undefined }

  if (s.phase) if (changed('phase', String(s.phase.current)) && prev['phase'] !== 'null' && prev['phase'] !== 'undefined') entries.push({ ...base, kind: 'phase', phase: s.phase.current ?? undefined, summary: `current phase is now ${s.phase.current ?? 'unknown'}` })
  if (s.review) {
    const r = s.review
    const v = `${r.requestId}:${r.state}:${r.promptHash}:${r.edited ? 1 : 0}`
    if (changed('review', v) || (seed('review', v) && false)) {
      const tpl = s.promptRes && s.promptRes.phase === r.phase ? { templateId: s.promptRes.templateId, version: s.promptRes.version } : {}
      entries.push({ ...base, kind: 'review', phase: r.phase, summary: `review ${r.state} for ${r.phase}${r.reason ? ` (${r.reason.slice(0, 80)})` : ''}`, ...tpl, promptHash: r.promptHash || undefined, overridden: !!r.edited })
    }
  }
  if (s.analyze) if (changed('analyze', String(s.analyze.at))) { const c = s.analyze.counts; entries.push({ ...base, kind: 'analyze', phase: 'analyze', summary: `analysis ${s.analyze.overall}: BLOCKER ${c.BLOCKER ?? 0}, HIGH ${c.HIGH ?? 0}, MEDIUM ${c.MEDIUM ?? 0}, LOW ${c.LOW ?? 0}` }) }
  if (s.artifacts) {
    const moved: string[] = []
    for (const [id, h] of Object.entries(s.artifacts)) { const k = 'art:' + id; if (changed(k, h)) moved.push(id); }
    for (const k of Object.keys(prev)) if (k.startsWith('art:') && !(k.slice(4) in s.artifacts)) { moved.push(k.slice(4) + ' (removed)'); }
    if (moved.length) entries.push({ ...base, kind: 'artifacts', summary: `artifacts changed: ${moved.join(', ')}` })
  }
  if (s.quality) for (const [phase, display] of Object.entries(s.quality)) {
    const k = 'q:' + phase
    const before = prev[k]
    if (changed(k, display)) entries.push({ ...base, kind: 'quality', phase, summary: `gate ${phase}: ${before} -> ${display}` })
  }
  if (s.trace) if (changed('trace', `${s.trace.status}:${s.trace.gaps}`)) entries.push({ ...base, kind: 'trace', summary: `traceability ${s.trace.status}, ${s.trace.gaps} gap(s)` })
  if (s.convergence) if (changed('conv', s.convergence.state)) entries.push({ ...base, kind: 'convergence', summary: `convergence ${s.convergence.state}` })
  // Seed baselines for first sightings (no entry: history records transitions, not the state found at startup).
  if (s.phase) seed('phase', String(s.phase.current))
  if (s.review) seed('review', `${s.review.requestId}:${s.review.state}:${s.review.promptHash}:${s.review.edited ? 1 : 0}`)
  if (s.analyze) seed('analyze', String(s.analyze.at))
  if (s.trace) seed('trace', `${s.trace.status}:${s.trace.gaps}`)
  if (s.convergence) seed('conv', s.convergence.state)
  return { entries, sig }
}

export function appendBounded(existing: HistoryEntry[], add: HistoryEntry[], max: number): HistoryEntry[] {
  return [...existing, ...add].slice(-Math.max(1, max))
}

const hhmm = (at: number) => new Date(at).toISOString().slice(11, 16)
export function formatTimeline(entries: HistoryEntry[], opts: { phase?: string; last?: boolean } = {}): string {
  let list = entries
  if (opts.phase) list = list.filter(e => e.phase === opts.phase)
  if (opts.last) list = list.slice(-1)
  if (!list.length) return opts.phase ? `No history for phase "${opts.phase}".` : 'No SDD history yet.'
  return list.slice(-30).map(e => `${hhmm(e.at)}  ${e.kind.padEnd(11)} ${e.phase ?? '-'}${e.templateId ? `  ${e.templateId} v${e.version}` : ''}${e.promptHash ? ` #${e.promptHash.slice(0, 8)}` : ''}${e.overridden ? ' [edited]' : ''}  ${e.summary}`).join('\n')
}
