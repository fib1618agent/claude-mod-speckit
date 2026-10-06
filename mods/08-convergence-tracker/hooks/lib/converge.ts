import type { PluginState } from 'claude-code'
import type { Convergence, ConvergenceException, ConvergenceState } from '../../types'
import { evidenceFreshness } from '../shared/evidence'

type Artifacts = PluginState['sdd-artifact-tracker']['artifacts']
type AnalyzeResult = PluginState['sdd-analyze-gate']['analyze']
type Trace = PluginState['sdd-traceability']['trace']
type Quality = PluginState['sdd-quality-gate']['quality']

export const EXCEPTION_SCOPES = ['analysis', 'tests', 'checks', 'trace'] as const
export type Checks = 'passing' | 'failing' | 'unknown'

// Tasks from tasks.md checkboxes. Checkboxes are CLAIMS: they are never sufficient evidence by themselves.
export function parseTasks(text: string): { total: number; done: number; doneIds: Set<string> } {
  const lines = text.split('\n').filter(l => /^\s*[-*]\s*\[[ xX]\]/.test(l))
  const doneIds = new Set<string>()
  let done = 0
  for (const l of lines) if (/\[[xX]\]/.test(l.slice(0, 12))) { done++; const id = /\bT\d{2,}\b/.exec(l)?.[0]; if (id) doneIds.add(id) }
  return { total: lines.length, done, doneIds }
}

export type ConvergeInput = {
  tasks: { total: number; done: number; doneIds: Set<string> }
  artifacts: Artifacts | undefined
  analyze: AnalyzeResult | undefined
  trace: Trace | undefined
  quality: Quality | undefined
  checks: Checks
  exceptions: ConvergenceException[]
  previous: ConvergenceState | undefined
  at: number
}

const waived = (ex: ConvergenceException[], scope: string) => ex.some(e => e.scope === scope)

export function deriveConvergence(i: ConvergeInput): Convergence {
  const rows = i.trace?.status === 'NOT_APPLICABLE' || !i.trace ? [] : i.trace.rows
  // A requirement is satisfied only when every mapped task is done AND something other than a checkbox backs it (a mapped test).
  const satisfied = rows.filter(r => r.tasks.length > 0 && r.tasks.every(t => i.tasks.doneIds.has(t)) && r.tests.length > 0)
  const doneWithoutEvidence = rows.filter(r => r.tasks.length > 0 && r.tasks.every(t => i.tasks.doneIds.has(t)) && r.tests.length === 0).map(r => r.id)
  const current = i.artifacts ? Object.fromEntries(i.artifacts.items.filter(x => x.exists).map(x => [x.id, x.hash])) : undefined
  const fresh = i.analyze ? evidenceFreshness(i.analyze.artifactHashes, current) : 'unknown'
  const analysisStale = !!i.analyze && fresh !== 'fresh'
  const blocking = i.analyze?.countsBySeverity.BLOCKER ?? 0
  const staleArtifacts = i.artifacts ? i.artifacts.items.filter(x => x.fresh === 'stale').map(x => x.id) : []

  const regressions: string[] = []
  // REGRESSED counts as "was good": a standing problem must keep the state REGRESSED, not flip back to CONVERGING on the next recompute.
  const wasGood = i.previous === 'CONVERGING' || i.previous === 'CONVERGED' || i.previous === 'REGRESSED'
  if (wasGood && analysisStale) regressions.push('analysis is stale: artifacts changed after the last Analyze')
  if (wasGood && i.checks === 'failing') regressions.push('tests/checks are failing')
  if (wasGood && staleArtifacts.length) regressions.push(`stale artifacts: ${staleArtifacts.join(', ')}`)
  if (wasGood && blocking > 0) regressions.push(`${blocking} BLOCKER finding(s) reported`)
  if (wasGood && i.trace?.status === 'GAPS' && !waived(i.exceptions, 'trace')) regressions.push(`${i.trace.gaps.length} traceability gap(s)`)

  const okAnalysis = waived(i.exceptions, 'analysis') || (i.analyze && !analysisStale && i.analyze.overall !== 'UNKNOWN' && blocking === 0)
  const okTests = waived(i.exceptions, 'tests') || (rows.length > 0 && satisfied.length === rows.length)
  const okChecks = waived(i.exceptions, 'checks') || i.checks === 'passing'
  const okTrace = waived(i.exceptions, 'trace') || (i.trace?.status === 'COMPLETE')
  const allDone = i.tasks.total > 0 && i.tasks.done === i.tasks.total

  let state: ConvergenceState
  if (regressions.length) state = 'REGRESSED'
  else if (blocking > 0 && !waived(i.exceptions, 'analysis')) state = 'BLOCKED'
  else if (i.checks === 'failing' && !waived(i.exceptions, 'checks')) state = 'BLOCKED'
  else if (i.tasks.done === 0) state = 'NOT_STARTED'
  else if (!allDone) state = 'IN_PROGRESS'
  else if (okAnalysis && okTests && okChecks && okTrace && staleArtifacts.length === 0) state = 'CONVERGED'
  else state = 'CONVERGING' // every task is claimed done, but the evidence is incomplete: never CONVERGED on checkboxes

  return {
    state, regressions, exceptions: i.exceptions, at: i.at,
    evidence: { requirementsSatisfied: satisfied.length, requirementsTotal: rows.length, tasksDone: i.tasks.done, tasksTotal: i.tasks.total, analysisRan: !!i.analyze, analysisStale, blockingFindings: blocking, checks: i.checks, doneWithoutEvidence },
  }
}

export function validateException(scope: string, reason: string): string | undefined {
  if (!(EXCEPTION_SCOPES as readonly string[]).includes(scope)) return `scope must be one of: ${EXCEPTION_SCOPES.join(', ')}`
  if (reason.trim().length < 8) return 'a reason of at least 8 characters is required'
  return undefined
}

// Best-effort observation of a test/check command run in this session.
export function looksLikeCheck(command: string): boolean {
  return /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|check|lint|typecheck)\b|\b(pytest|vitest|jest|mocha|tsc)\b|\bcargo\s+(test|check|clippy)\b|\bgo\s+test\b|\bclaude\s+plugin\s+(test|validate)\b/.test(command)
}

export function formatConvergence(c: Convergence | undefined): string {
  if (!c) return 'No convergence evidence yet.'
  const e = c.evidence
  return [
    `Convergence: ${c.state}`,
    `requirements satisfied ${e.requirementsSatisfied}/${e.requirementsTotal} · tasks done ${e.tasksDone}/${e.tasksTotal} · checks ${e.checks} · outstanding BLOCKER findings ${e.blockingFindings} · analysis ${!e.analysisRan ? 'NOT RUN' : e.analysisStale ? 'STALE' : 'current'}`,
    ...(e.doneWithoutEvidence.length ? [`Done but without test evidence: ${e.doneWithoutEvidence.join(', ')}`] : []),
    ...(c.regressions.length ? ['Regressions:', ...c.regressions.map(r => '  - ' + r)] : []),
    ...(c.exceptions.length ? ['Exceptions (recorded, user-approved):', ...c.exceptions.map(x => `  - ${x.scope}: ${x.reason}`)] : []),
  ].join('\n')
}
