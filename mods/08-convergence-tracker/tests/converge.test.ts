import { test, expect } from 'claude-code/testing'
import { deriveConvergence, formatConvergence, looksLikeCheck, parseTasks, validateException, type ConvergeInput } from '../hooks/lib/converge'

const it = (id: string, hash = 'h-' + id, fresh: 'fresh' | 'stale' = 'fresh') => ({ id, exists: true, hash, mtime: 1, producedBy: id, dependsOn: [], fresh, status: 'present' })
const arts = (fresh: 'fresh' | 'stale' = 'fresh') => ({ items: [it('spec'), it('plan', 'h-plan', fresh), it('tasks')], feature: 'f', isSpecKit: true, at: 1 }) as any
const HASHES = { spec: 'h-spec', plan: 'h-plan', tasks: 'h-tasks' }
const counts = (b = 0) => ({ BLOCKER: b, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 })
const analyze = (o: any = {}) => ({ at: 1, countsBySeverity: counts(), findings: [], truncated: false, artifactHashes: HASHES, overall: 'READY', ...o })
const row = (id: string, tasks: string[], tests: string[]) => ({ id, plan: true, acceptance: true, tasks, tests, implementation: true, status: 'covered' })
const trace = (rows: any[], status = 'COMPLETE', gaps: any[] = []) => ({ rows, counts: {}, gaps, status, at: 1 }) as any
const done = (n: number, total: number) => parseTasks(Array.from({ length: total }, (_, i) => `- [${i < n ? 'x' : ' '}] T00${i + 1} thing FR-00${i + 1}`).join('\n'))
const base = (o: Partial<ConvergeInput> = {}): ConvergeInput => ({
  tasks: done(2, 2), artifacts: arts(), analyze: analyze() as any,
  trace: trace([row('FR-001', ['T001'], ['a.test.ts']), row('FR-002', ['T002'], ['b.test.ts'])]), quality: undefined,
  checks: 'passing', exceptions: [], previous: undefined, at: 1, ...o,
})

test('NOT_STARTED with no completed tasks; IN_PROGRESS with some', () => {
  expect(deriveConvergence(base({ tasks: done(0, 2) })).state).toBe('NOT_STARTED')
  expect(deriveConvergence(base({ tasks: done(1, 2) })).state).toBe('IN_PROGRESS')
})

test('CONVERGED only with full evidence: all tasks, tests mapped, checks passing, fresh clean analysis, complete trace', () => {
  const c = deriveConvergence(base())
  expect(c.state).toBe('CONVERGED'); expect(c.evidence.requirementsSatisfied).toBe(2)
})

test('NEVER CONVERGED from task checkboxes alone: every task done but no test evidence => CONVERGING', () => {
  const c = deriveConvergence(base({ trace: trace([row('FR-001', ['T001'], []), row('FR-002', ['T002'], [])]), checks: 'unknown', analyze: undefined }))
  expect(c.state).toBe('CONVERGING'); expect(c.evidence.doneWithoutEvidence).toEqual(['FR-001', 'FR-002'])
})

test('no evidence at all (no trace, no analysis, unknown checks) cannot converge', () => {
  expect(deriveConvergence(base({ trace: undefined, analyze: undefined, checks: 'unknown' })).state).toBe('CONVERGING')
  expect(deriveConvergence(base({ artifacts: undefined, trace: undefined, analyze: undefined, checks: 'unknown', tasks: parseTasks('') })).state).toBe('NOT_STARTED')
})

test('stale analysis blocks convergence; unparsable analysis does too', () => {
  expect(deriveConvergence(base({ analyze: analyze({ artifactHashes: { ...HASHES, plan: 'OLD' } }) as any })).state).toBe('CONVERGING')
  expect(deriveConvergence(base({ analyze: analyze({ overall: 'UNKNOWN' }) as any })).state).toBe('CONVERGING')
})

test('BLOCKER findings or failing checks => BLOCKED', () => {
  expect(deriveConvergence(base({ analyze: analyze({ countsBySeverity: counts(2), overall: 'BLOCKED' }) as any })).state).toBe('BLOCKED')
  expect(deriveConvergence(base({ checks: 'failing' })).state).toBe('BLOCKED')
})

test('REGRESSED: previously converged, then analysis goes stale / checks fail / artifact goes stale / new trace gaps', () => {
  const stale = deriveConvergence(base({ previous: 'CONVERGED', analyze: analyze({ artifactHashes: { ...HASHES, spec: 'OLD' } }) as any }))
  expect(stale.state).toBe('REGRESSED'); expect(stale.regressions[0]).toContain('stale')
  expect(deriveConvergence(base({ previous: 'CONVERGING', checks: 'failing' })).state).toBe('REGRESSED')
  expect(deriveConvergence(base({ previous: 'CONVERGED', artifacts: arts('stale') })).regressions.join()).toContain('stale artifacts')
  expect(deriveConvergence(base({ previous: 'CONVERGED', trace: trace([row('FR-001', ['T001'], ['a'])], 'GAPS', [{ kind: 'orphan-task', id: 'T9', inferred: false }]) })).state).toBe('REGRESSED')
})

test('no regression is claimed unless there was progress to lose', () => {
  expect(deriveConvergence(base({ previous: 'IN_PROGRESS', checks: 'failing' })).state).toBe('BLOCKED')
})

test('exceptions waive only their scope and are listed in the state', () => {
  const noTests = trace([row('FR-001', ['T001'], []), row('FR-002', ['T002'], [])])
  expect(deriveConvergence(base({ trace: noTests })).state).toBe('CONVERGING')
  const ex = [{ id: 'X1', scope: 'tests', reason: 'manual QA signed off', at: 1 }]
  const c = deriveConvergence(base({ trace: noTests, exceptions: ex }))
  expect(c.state).toBe('CONVERGED'); expect(c.exceptions).toEqual(ex)
  expect(deriveConvergence(base({ trace: noTests, exceptions: ex, checks: 'failing' })).state).toBe('BLOCKED') // tests waiver does not hide failing checks
  expect(formatConvergence(c)).toContain('Exceptions')
})

test('exception validation: known scope and a real reason are required', () => {
  expect(validateException('tests', 'manual QA signed off')).toBeUndefined()
  expect(validateException('everything', 'manual QA signed off')).toContain('scope')
  expect(validateException('tests', 'no')).toContain('reason')
})

test('task parsing and check detection', () => {
  const t = parseTasks('- [x] T001 a\n- [ ] T002 b\n- [X] T003 c\nnot a task')
  expect(t.total).toBe(3); expect(t.done).toBe(2); expect([...t.doneIds]).toEqual(['T001', 'T003'])
  for (const c of ['npm test', 'pnpm run typecheck', 'pytest -q', 'cargo test', 'claude plugin test .']) expect(looksLikeCheck(c)).toBe(true)
  for (const c of ['ls', 'git status', 'cat package.json']) expect(looksLikeCheck(c)).toBe(false)
})

function env(on: any, state: Record<string, any>, answer = 'Yes') {
  const store: Record<string, any> = {}; const toasts: string[] = []
  on('session.root', async () => ({ value: '/p' })); on('clock.now', async () => ({ value: 4 }))
  on('fs.read', async () => ({ value: '- [x] T001 a FR-001' }))
  on('state.get', async (_$: any, e: any) => ({ value: { value: state[e.plugin + '.' + e.key], version: 1 } }))
  on('state.set', async (_$: any, e: any) => { state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  on('store.get', async (_$: any, e: any) => ({ value: store[e.key] })); on('store.set', async (_$: any, e: any) => { store[e.key] = e.value; return { value: undefined } })
  on('ui.toast', async (_$: any, e: any) => { toasts.push(e.text); return { value: undefined } })
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$: any, e: any) => ({ result: { questions: e.questions, answers: { [e.questions[0].question]: answer } } }))
  return { store, toasts }
}

test('/sdd-converge reanalyze only REQUESTS: it answers at once and runs nothing itself', async ($: any, on: any) => {
  const state: Record<string, any> = {}
  env(on, state)
  const out = await $.command.run({ command: 'sdd-converge', args: 'reanalyze' })
  expect(out.text).toContain('Review Gate'); expect(state['sdd-convergence-tracker.convergence']).toBeUndefined()
})

test('exceptions need explicit confirmation and are stored project-keyed as metadata', async ($: any, on: any) => {
  const state: Record<string, any> = {}
  const no = env(on, state, 'No')
  expect((await $.command.run({ command: 'sdd-converge', args: 'except tests manual QA signed off' })).text).toContain('no confirmation')
  expect(Object.keys(no.store)).toEqual([])
})

test('confirmed exception is recorded and changes no artifact', async ($: any, on: any) => {
  const state: Record<string, any> = {}
  const e = env(on, state, 'Yes')
  const out = await $.command.run({ command: 'sdd-converge', args: 'except tests manual QA signed off' })
  expect(out.text).toContain('recorded'); expect(Object.keys(e.store)[0]).toMatch(/^converge:p-/)
  expect(state['sdd-convergence-tracker.convergence'].exceptions[0].scope).toBe('tests')
})
