import { test, expect } from 'claude-code/testing'
import { analyzeTrace, formatTrace } from '../hooks/lib/trace'

const SPEC = `# Spec
- **FR-001**: users can add items
- **FR-002**: users can delete items
- **NFR-001**: responds in 200ms
Acceptance: Given a list When adding Then the item appears (FR-001)
Acceptance: Given an item When deleting Then it is gone (FR-002)
AC-3 covers NFR-001`
const base = { specText: SPEC, planText: 'Plan covers FR-001 and FR-002', tasksText: '', tests: [], implementation: [], at: 1 }
const kinds = (t: ReturnType<typeof analyzeTrace>) => t.gaps.map(g => g.kind + ':' + g.id).sort()

test('perfect coverage: COMPLETE, no gaps, every requirement mapped to tasks', () => {
  const t = analyzeTrace({ ...base, tasksText: '- [ ] T001 add item FR-001\n- [x] T002 delete FR-002\n- [ ] T003 perf NFR-001' })
  expect(t.status).toBe('COMPLETE'); expect(t.gaps).toEqual([]); expect(t.counts.requirements).toBe(3); expect(t.counts.covered).toBe(3)
})

test('uncovered requirement and task without requirement are reported', () => {
  const t = analyzeTrace({ ...base, tasksText: '- [ ] T001 add item FR-001\n- [ ] T009 refactor stuff' })
  expect(kinds(t)).toContain('uncovered-requirement:FR-002')
  expect(kinds(t)).toContain('task-without-requirement:T009')
  expect(t.status).toBe('GAPS')
})

test('orphan task: references a requirement that does not exist', () => {
  const t = analyzeTrace({ ...base, tasksText: '- [ ] T001 FR-001\n- [ ] T002 FR-002\n- [ ] T003 NFR-001\n- [ ] T004 ghost FR-099' })
  expect(kinds(t)).toEqual(['orphan-task:T004'])
})

test('requirement without acceptance is reported only when the project cites IDs in acceptance lines (no guessing)', () => {
  const t = analyzeTrace({ ...base, specText: SPEC.replace('(FR-002)', ''), tasksText: '- [ ] T001 FR-001\n- [ ] T002 FR-002\n- [ ] T003 NFR-001' })
  expect(kinds(t)).toEqual(['requirement-without-acceptance:FR-002'])
  const noRefs = analyzeTrace({ ...base, specText: '- **FR-001**: x\n- **FR-002**: y', tasksText: '- [ ] T1 FR-001\n- [ ] T2 FR-002' })
  expect(noRefs.gaps).toEqual([])
})

test('tests: tests without requirement flagged only when other tests do cite IDs; mapped tests counted', () => {
  const t = analyzeTrace({ ...base, tasksText: '- [ ] T001 FR-001\n- [ ] T002 FR-002\n- [ ] T003 NFR-001', tests: [{ path: 'a.test.ts', text: "it('FR-001 adds')" }, { path: 'b.test.ts', text: "it('misc')" }] })
  expect(kinds(t)).toEqual(['test-without-requirement:b.test.ts'])
  expect(t.counts.tests).toBe(1)
})

test('implementation without a mapped task is reported', () => {
  const t = analyzeTrace({ ...base, tasksText: '- [ ] T001 FR-001 in src/a.ts\n- [ ] T002 FR-002\n- [ ] T003 NFR-001', implementation: ['src/a.ts', 'src/stray.ts'] })
  expect(kinds(t)).toEqual(['implementation-without-task:src/stray.ts'])
})

test('no requirement IDs: NOT_APPLICABLE and no invented traceability', () => {
  const t = analyzeTrace({ ...base, specText: 'Users can add items. Users can delete items.', tasksText: '- [ ] T001 add items' })
  expect(t.status).toBe('NOT_APPLICABLE'); expect(t.rows).toEqual([]); expect(formatTrace(t)).toContain('NOT_APPLICABLE')
})

test('changed IDs: the old ID becomes an orphan and the new one uncovered; nothing is silently remapped', () => {
  const t = analyzeTrace({ ...base, specText: '- **FR-010**: renamed', tasksText: '- [ ] T001 FR-001' })
  expect(kinds(t)).toEqual(['orphan-task:T001', 'uncovered-requirement:FR-010'])
})

test('ambiguous semantic similarity is NOT a link: similar words without IDs create no coverage', () => {
  const t = analyzeTrace({ ...base, tasksText: '- [ ] T001 users can add items to the list' })
  expect(t.counts.covered).toBe(0); expect(t.gaps.every(g => g.inferred === false)).toBe(true)
})

test('/sdd-trace without an artifact inventory reports unavailable, with capability degraded', async ($: any, on: any) => {
  const state: Record<string, any> = {}
  on('session.root', async () => ({ value: '/p' })); on('clock.now', async () => ({ value: 1 }))
  on('state.get', async (_$: any, e: any) => ({ value: { value: state[e.plugin + '.' + e.key], version: 1 } }))
  on('state.set', async (_$: any, e: any) => { state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  const out = await $.command.run({ command: 'sdd-trace' })
  expect(out.text).toContain('unavailable'); expect(state['sdd-traceability.capability'].status).toBe('degraded')
})
