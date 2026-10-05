import type { PluginState } from 'claude-code'
import type { Approval, DisplayStatus, Gate, GateEvidence, GateStatus, Quality } from '../../types'
import { fingerprint } from '../shared/fingerprint'
import { evidenceFreshness } from '../shared/evidence'

type Artifacts = PluginState['sdd-artifact-tracker']['artifacts']
type AnalyzeResult = PluginState['sdd-analyze-gate']['analyze']
type Trace = PluginState['sdd-traceability']['trace']

export type GateConfig = { analyzeRequiredBeforeImplement: boolean; approvalRequired: string[]; scoreFormula?: string }
export type EvalInput = {
  phases: string[]
  artifacts: Artifacts | undefined
  analyze: AnalyzeResult | undefined
  trace: Trace | undefined
  cfg: GateConfig
  approvals: Record<string, Approval>
  at: number
}

// Required artifacts per phase to be READY TO PROCEED with that phase. Unknown phases are NOT_APPLICABLE (no rules, no guessing).
export const REQUIRES: Record<string, { required: string[]; recommended: string[] }> = {
  constitution: { required: [], recommended: [] },
  specify: { required: [], recommended: ['constitution'] },
  clarify: { required: ['spec'], recommended: [] },
  plan: { required: ['spec'], recommended: ['constitution'] },
  checklist: { required: ['spec', 'plan'], recommended: [] },
  tasks: { required: ['spec', 'plan'], recommended: [] },
  analyze: { required: ['spec', 'plan', 'tasks'], recommended: [] },
  implement: { required: ['spec', 'plan', 'tasks'], recommended: ['checklist'] },
  converge: { required: ['spec', 'plan', 'tasks'], recommended: [] },
}

export const DISPLAY: Record<GateStatus, DisplayStatus> = {
  PASS: 'READY', PASS_WITH_WARNINGS: 'WARNING', BLOCKED: 'BLOCKED', NOT_READY: 'NOT_READY', NOT_APPLICABLE: 'NOT_APPLICABLE',
}

function analyzeStale(a: AnalyzeResult, inv: Artifacts): boolean {
  const cur = Object.fromEntries(inv.items.filter(i => i.exists).map(i => [i.id, i.hash]))
  return evidenceFreshness(a.artifactHashes, cur) !== 'fresh'
}

// The key an approval is bound to: the evidence it was given for. Any change invalidates the approval.
export function evidenceKey(phase: string, e: GateEvidence[]): string {
  return fingerprint(phase + '|' + e.map(x => `${x.source}:${x.ref}:${x.hash ?? ''}`).sort().join('|'))
}

export function evaluateGate(phase: string, i: EvalInput): Gate {
  const rule = REQUIRES[phase]
  const base = { phase, at: i.at }
  if (!rule) return { ...base, status: 'NOT_APPLICABLE', display: 'NOT_APPLICABLE', blockers: [], warnings: [], evidence: [] }
  const evidence: GateEvidence[] = []
  const blockers: string[] = []
  const warnings: string[] = []
  let hard = false
  const inv = i.artifacts
  if (!inv || !inv.isSpecKit) {
    const why = !inv ? 'no artifact inventory (Artifact Tracker unavailable)' : 'not a Spec-Kit project'
    return { ...base, status: inv ? 'NOT_APPLICABLE' : 'NOT_READY', display: inv ? 'NOT_APPLICABLE' : 'UNKNOWN', blockers: inv ? [] : [why], warnings: [], evidence: [{ source: 'artifacts', ref: 'inventory' }] }
  }
  const byId = new Map(inv.items.map(x => [x.id, x]))
  for (const id of rule.required) {
    const a = byId.get(id)
    evidence.push({ source: 'artifacts', ref: id, hash: a?.hash })
    if (!a || !a.exists) blockers.push(`required artifact "${id}" is missing`)
    else if (a.fresh === 'stale') blockers.push(`required artifact "${id}" is stale (an upstream artifact changed after it)`)
    else if (a.fresh === 'unknown') blockers.push(`cannot establish that "${id}" is fresh`)
  }
  for (const id of rule.recommended) {
    const a = byId.get(id)
    evidence.push({ source: 'artifacts', ref: id, hash: a?.hash })
    if (!a || !a.exists) warnings.push(`recommended artifact "${id}" is missing`)
    else if (a.fresh === 'stale') warnings.push(`recommended artifact "${id}" is stale`)
  }

  if (phase === 'implement' || phase === 'converge') {
    const a = i.analyze
    const needed = phase === 'implement' && i.cfg.analyzeRequiredBeforeImplement
    if (!a) (needed ? blockers : warnings).push('Analyze has not been run')
    else {
      evidence.push({ source: 'analyze', ref: String(a.at), hash: fingerprint(JSON.stringify(a.countsBySeverity) + a.overall) })
      if (analyzeStale(a, inv)) (needed ? blockers : warnings).push('the Analyze result is stale (artifacts changed since)')
      else if (a.overall === 'UNKNOWN') (needed ? blockers : warnings).push('the Analyze report could not be parsed')
      if (a.countsBySeverity.BLOCKER > 0) { hard = true; blockers.push(`Analyze reports ${a.countsBySeverity.BLOCKER} BLOCKER finding(s)`) }
      if (a.countsBySeverity.HIGH > 0) warnings.push(`Analyze reports ${a.countsBySeverity.HIGH} HIGH finding(s)`)
    }
  }
  if (i.trace && i.trace.status === 'GAPS') {
    evidence.push({ source: 'trace', ref: 'gaps', hash: fingerprint(JSON.stringify(i.trace.gaps.map(g => g.kind + g.id))) })
    warnings.push(`${i.trace.gaps.length} traceability gap(s)`)
  }

  const key = evidenceKey(phase, evidence)
  const ap = i.approvals[phase]
  const live = ap && ap.evidenceKey === key ? ap : undefined // approvals/rejections for other evidence are void
  if (live?.decision === 'rejected') { hard = true; blockers.push('rejected by the user for the current evidence') }
  if (!blockers.length && i.cfg.approvalRequired.includes(phase) && !(live && (live.decision === 'approved' || live.decision === 'continued'))) blockers.push('awaiting explicit approval')

  const status: GateStatus = hard ? 'BLOCKED' : blockers.length ? 'NOT_READY' : warnings.length ? 'PASS_WITH_WARNINGS' : 'PASS'
  return { ...base, status, display: DISPLAY[status], blockers, warnings, evidence }
}

// Named, explicit, configurable. There is no default score: without a configured known formula `score` is absent.
export function computeScore(formula: string | undefined, gates: Gate[]): Quality['score'] | undefined {
  if (formula !== 'gates-ready-ratio') return undefined
  const applicable = gates.filter(g => g.status !== 'NOT_APPLICABLE')
  if (!applicable.length) return undefined
  const ready = applicable.filter(g => g.status === 'PASS' || g.status === 'PASS_WITH_WARNINGS').length
  return { value: Math.round((100 * ready) / applicable.length), formula: 'gates-ready-ratio = 100 * gates PASS or PASS_WITH_WARNINGS / applicable gates' }
}

export function evaluateAll(i: EvalInput): Quality {
  const gates: Record<string, Gate> = {}
  for (const p of i.phases) gates[p] = evaluateGate(p, i)
  const all = Object.values(gates)
  const score = computeScore(i.cfg.scoreFormula, all)
  return {
    gates,
    blockers: all.flatMap(g => g.blockers.map(b => `${g.phase}: ${b}`)),
    warnings: all.flatMap(g => g.warnings.map(w => `${g.phase}: ${w}`)),
    approval: i.approvals,
    at: i.at,
    ...(score ? { score } : {}),
  }
}

export type Decision = 'approved' | 'rejected' | 'continued'
// Returns the new approval, or a refusal reason. 06 alone decides; callers only request.
export function decide(decision: Decision, gate: Gate | undefined, cfgApproval: boolean, at: number): { ok: true; approval: Approval } | { ok: false; reason: string } {
  if (!gate) return { ok: false, reason: 'unknown phase' }
  const key = evidenceKey(gate.phase, gate.evidence)
  const approval: Approval = { phase: gate.phase, decision, at, evidenceKey: key }
  if (decision === 'rejected') return { ok: true, approval }
  const onlyAwaiting = gate.blockers.length === 1 && gate.blockers[0] === 'awaiting explicit approval'
  if (gate.status === 'NOT_APPLICABLE') return { ok: false, reason: 'gate not applicable to this phase' }
  if (gate.blockers.length && !onlyAwaiting) return { ok: false, reason: `cannot ${decision === 'approved' ? 'approve' : 'continue'}: ${gate.blockers.filter(b => b !== 'awaiting explicit approval').join('; ')}` }
  if (decision === 'continued' && cfgApproval && onlyAwaiting) return { ok: false, reason: 'approval is required first: approve this gate, then continue' }
  return { ok: true, approval }
}

export function formatQuality(q: Quality | undefined, onlyPhase?: string): string {
  if (!q) return 'No quality evidence yet.'
  const gates = Object.values(q.gates).filter(g => !onlyPhase || g.phase === onlyPhase)
  if (!gates.length) return onlyPhase ? `No gate for phase "${onlyPhase}".` : 'No gates.'
  const rows = gates.map(g => `${g.phase.padEnd(14)} ${g.display.padEnd(14)} ${[...g.blockers, ...g.warnings.map(w => 'warn: ' + w)].join('; ') || ''}`)
  return rows.join('\n') + (q.score ? `\nScore: ${q.score.value} (${q.score.formula})` : '')
}
