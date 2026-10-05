import { test, expect } from 'claude-code/testing'
import { decide, evaluateAll, evaluateGate, evidenceKey, formatQuality, type EvalInput } from '../hooks/lib/gates'

const it = (id: string, exists = true, fresh: 'fresh' | 'stale' | 'unknown' = 'fresh', hash = 'h-' + id) => ({ id, exists, hash: exists ? hash : '', mtime: 1, producedBy: id, dependsOn: [], fresh, status: exists ? 'present' : 'missing' })
const inv = (items: any[]) => ({ items, feature: 'f', isSpecKit: true, at: 1 })
const FULL = () => inv([it('constitution'), it('spec'), it('plan'), it('checklist'), it('tasks')])
const counts = (o: Partial<Record<string, number>> = {}) => ({ BLOCKER: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0, ...o })
const analyze = (hashes: Record<string, string>, c = counts(), overall = 'READY') => ({ at: 5, countsBySeverity: c, findings: [], truncated: false, artifactHashes: hashes, overall })
const HASHES = { constitution: 'h-constitution', spec: 'h-spec', plan: 'h-plan', checklist: 'h-checklist', tasks: 'h-tasks' }
const base = (o: Partial<EvalInput> = {}): EvalInput => ({
  phases: ['constitution', 'specify', 'clarify', 'plan', 'checklist', 'tasks', 'analyze', 'implement', 'converge', 'taskstoissues'],
  artifacts: FULL() as any, analyze: undefined, trace: undefined, approvals: {}, at: 1,
  cfg: { analyzeRequiredBeforeImplement: true, approvalRequired: [] }, ...o,
})

test('PASS: plan gate with a fresh spec; display READY; no score by default', () => {
  const q = evaluateAll(base())
  expect(q.gates.plan!.status).toBe('PASS'); expect(q.gates.plan!.display).toBe('READY')
  expect(q.score).toBeUndefined()
  expect(formatQuality(q)).not.toMatch(/\d+%/)
})

test('PASS_WITH_WARNINGS: missing recommended artifact is a warning, not a blocker', () => {
  const g = evaluateGate('specify', base({ artifacts: inv([it('spec')]) as any }))
  expect(g.status).toBe('PASS_WITH_WARNINGS'); expect(g.display).toBe('WARNING'); expect(g.warnings[0]).toContain('constitution')
})

test('NOT_READY: required artifact missing, and stale required artifact', () => {
  expect(evaluateGate('tasks', base({ artifacts: inv([it('spec')]) as any })).status).toBe('NOT_READY')
  const g = evaluateGate('tasks', base({ artifacts: inv([it('spec'), it('plan', true, 'stale')]) as any }))
  expect(g.status).toBe('NOT_READY'); expect(g.blockers.join()).toContain('stale')
})

test('unknown freshness cannot pass: it is NOT_READY, not assumed fresh', () => {
  expect(evaluateGate('tasks', base({ artifacts: inv([it('spec'), it('plan', true, 'unknown')]) as any })).status).toBe('NOT_READY')
})

test('implement is NOT_READY without an Analyze result when analyze-before-implement is configured', () => {
  const g = evaluateGate('implement', base())
  expect(g.status).toBe('NOT_READY'); expect(g.blockers).toContain('Analyze has not been run')
  const off = evaluateGate('implement', base({ cfg: { analyzeRequiredBeforeImplement: false, approvalRequired: [] } }))
  expect(off.status).toBe('PASS_WITH_WARNINGS')
})

test('implement is BLOCKED by an Analyze BLOCKER finding (configured blocker stops implementation)', () => {
  const g = evaluateGate('implement', base({ analyze: analyze(HASHES, counts({ BLOCKER: 1 }), 'BLOCKED') as any }))
  expect(g.status).toBe('BLOCKED'); expect(g.display).toBe('BLOCKED')
})

test('implement: stale Analyze (artifact hash changed) is NOT_READY; fresh clean Analyze passes; HIGH only warns', () => {
  expect(evaluateGate('implement', base({ analyze: analyze({ ...HASHES, plan: 'OLD' }) as any })).status).toBe('NOT_READY')
  expect(evaluateGate('implement', base({ analyze: analyze(HASHES) as any })).status).toBe('PASS')
  const hi = evaluateGate('implement', base({ analyze: analyze(HASHES, counts({ HIGH: 2 }), 'NOT_READY') as any }))
  expect(hi.status).toBe('PASS_WITH_WARNINGS'); expect(hi.warnings.join()).toContain('HIGH')
})

test('unparsable Analyze (UNKNOWN) does not satisfy the gate', () => {
  expect(evaluateGate('implement', base({ analyze: analyze(HASHES, counts(), 'UNKNOWN') as any })).status).toBe('NOT_READY')
})

test('traceability gaps become warnings from evidence', () => {
  const g = evaluateGate('implement', base({ analyze: analyze(HASHES) as any, trace: { rows: [], counts: {} as any, gaps: [{ kind: 'orphan-task', id: 'T1', inferred: false }], status: 'GAPS', at: 1 } as any }))
  expect(g.status).toBe('PASS_WITH_WARNINGS')
})

test('NOT_APPLICABLE for an unknown future phase; no inventory is NOT_READY/UNKNOWN, never a pass', () => {
  expect(evaluateGate('taskstoissues', base()).status).toBe('NOT_APPLICABLE')
  const g = evaluateGate('plan', base({ artifacts: undefined }))
  expect(g.status).toBe('NOT_READY'); expect(g.display).toBe('UNKNOWN')
  expect(evaluateGate('plan', base({ artifacts: { items: [], feature: null, isSpecKit: false, at: 1 } })).status).toBe('NOT_APPLICABLE')
})

test('approval required: awaiting approval, then approved for THIS evidence, then voided by changed evidence', () => {
  const cfg = { analyzeRequiredBeforeImplement: false, approvalRequired: ['plan'] }
  const g0 = evaluateGate('plan', base({ cfg }))
  expect(g0.status).toBe('NOT_READY'); expect(g0.blockers).toEqual(['awaiting explicit approval'])
  const ok = decide('approved', g0, true, 9)
  expect(ok.ok).toBe(true)
  const approved = (ok as any).approval
  expect(evaluateGate('plan', base({ cfg, approvals: { plan: approved } })).status).toBe('PASS')
  const changed = base({ cfg, approvals: { plan: approved }, artifacts: inv([it('constitution'), it('spec', true, 'fresh', 'h-spec-EDITED')]) as any })
  expect(evaluateGate('plan', changed).blockers).toEqual(['awaiting explicit approval']) // approval no longer applies
})

test('reject blocks until the evidence changes; Reject is always recordable', () => {
  const g0 = evaluateGate('plan', base())
  const rej = (decide('rejected', g0, false, 1) as any).approval
  const g1 = evaluateGate('plan', base({ approvals: { plan: rej } }))
  expect(g1.status).toBe('BLOCKED'); expect(g1.blockers.join()).toContain('rejected')
  expect(evaluateGate('plan', base({ approvals: { plan: rej }, artifacts: inv([it('spec', true, 'fresh', 'NEW')]) as any })).status).not.toBe('BLOCKED')
})

test('cannot approve or continue past real blockers; continue needs approval first when approval is required', () => {
  const blocked = evaluateGate('implement', base({ analyze: analyze(HASHES, counts({ BLOCKER: 1 }), 'BLOCKED') as any }))
  expect(decide('approved', blocked, false, 1).ok).toBe(false)
  expect(decide('continued', blocked, false, 1).ok).toBe(false)
  const awaiting = evaluateGate('plan', base({ cfg: { analyzeRequiredBeforeImplement: false, approvalRequired: ['plan'] } }))
  expect(decide('continued', awaiting, true, 1)).toEqual({ ok: false, reason: 'approval is required first: approve this gate, then continue' })
})

test('score exists only with an explicit known formula', () => {
  expect(evaluateAll(base()).score).toBeUndefined()
  expect(evaluateAll(base({ cfg: { analyzeRequiredBeforeImplement: true, approvalRequired: [], scoreFormula: 'made-up' } })).score).toBeUndefined()
  const s = evaluateAll(base({ cfg: { analyzeRequiredBeforeImplement: true, approvalRequired: [], scoreFormula: 'gates-ready-ratio' } })).score
  expect(s?.formula).toContain('gates-ready-ratio'); expect(typeof s?.value).toBe('number')
})

test('evidence keys are stable and change with the evidence', () => {
  const a = evidenceKey('plan', [{ source: 'artifacts', ref: 'spec', hash: '1' }])
  expect(a).toBe(evidenceKey('plan', [{ source: 'artifacts', ref: 'spec', hash: '1' }]))
  expect(a).not.toBe(evidenceKey('plan', [{ source: 'artifacts', ref: 'spec', hash: '2' }]))
})
