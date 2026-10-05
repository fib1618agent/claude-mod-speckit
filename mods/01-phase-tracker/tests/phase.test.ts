import { test, expect } from 'claude-code/testing'
import { derivePhase, formatPhase } from '../hooks/lib/derive'

const model = ['constitution', 'specify', 'clarify', 'plan', 'checklist', 'tasks', 'analyze', 'implement', 'converge']
const item = (id: string, exists: boolean, fresh: 'fresh' | 'stale' | 'unknown' = 'fresh', status: 'present' | 'missing' | 'unreadable' = exists ? 'present' : 'missing') =>
  ({ id, exists, hash: exists ? 'h' : '', mtime: 1, producedBy: id, dependsOn: [], fresh, status })
const inv = (items: any[]) => ({ items, feature: '001-x', isSpecKit: true, at: 1 })
const st = (p: ReturnType<typeof derivePhase>, id: string) => p.phases.find(x => x.id === id)!.status

test('fresh project: constitution is the current phase, nothing is complete', () => {
  const p = derivePhase(model, inv([item('constitution', false), item('spec', false), item('plan', false), item('checklist', false), item('tasks', false)]), 1)
  expect(p.current).toBe('constitution'); expect(p.next).toBe('specify')
  expect(p.phases.filter(x => x.status === 'complete')).toEqual([])
})

test('partially complete: spec present, plan missing -> current is plan; clarify (no artifact) is not guessed complete', () => {
  const p = derivePhase(model, inv([item('constitution', true), item('spec', true), item('plan', false), item('checklist', false), item('tasks', false)]), 1)
  expect(st(p, 'constitution')).toBe('complete'); expect(st(p, 'specify')).toBe('complete')
  expect(st(p, 'clarify')).toBe('unknown')
  expect(p.current).toBe('plan'); expect(st(p, 'plan')).toBe('current'); expect(p.next).toBe('checklist')
})

test('stale artifact is blocked and becomes the current phase (regeneration needed)', () => {
  const p = derivePhase(model, inv([item('constitution', true), item('spec', true), item('plan', true, 'stale'), item('tasks', true)]), 1)
  expect(st(p, 'plan')).toBe('blocked'); expect(p.current).toBe('plan')
})

test('completed artifacts: unevidenced phases after the last complete are unknown, never invented complete', () => {
  const p = derivePhase(model, inv([item('constitution', true), item('spec', true), item('plan', true), item('checklist', true), item('tasks', true)]), 1)
  expect(st(p, 'tasks')).toBe('complete'); expect(st(p, 'analyze')).toBe('current'); expect(st(p, 'implement')).toBe('unknown'); expect(st(p, 'converge')).toBe('unknown')
  expect(p.current).toBe('analyze')
})

test('missing artifact: unreadable evidence is unknown, not complete', () => {
  const p = derivePhase(model, inv([item('constitution', true, 'unknown', 'unreadable'), item('spec', false)]), 1)
  expect(st(p, 'constitution')).toBe('unknown')
})

test('unknown future Spec-Kit phase is kept and reported unknown', () => {
  const p = derivePhase([...model, 'taskstoissues'], inv([item('constitution', false)]), 1)
  expect(st(p, 'taskstoissues')).toBe('unknown')
})

test('no inventory or not a Spec-Kit project: phase unknown with a reason (hard dependency on 05, no fallback discovery)', () => {
  expect(derivePhase(model, undefined, 1).reason).toContain('Artifact Tracker')
  expect(derivePhase(model, { items: [], feature: null, isSpecKit: false, at: 1 }, 1).reason).toBe('not a Spec-Kit project')
  expect(formatPhase(derivePhase(model, undefined, 1))).toContain('unknown')
})

test('/sdd-status refresh reads state only from 05 and reports degraded capability when 05 is absent', async ($: any, on: any) => {
  const state: Record<string, any> = {}
  on('session.root', async () => ({ value: '/proj' }))
  on('clock.now', async () => ({ value: 5 }))
  on('fs.exists', async () => ({ value: false }))
  on('fs.list', async () => { throw new Error('ENOENT') })
  on('state.get', async (_$: any, e: any) => ({ value: { value: state[e.plugin + '.' + e.key], version: 1 } }))
  on('state.set', async (_$: any, e: any) => { state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  on('command.register', async (_$: any, e: any) => ({ value: { command: e.name } }))
  on('command.list', async () => ({ value: [] }))
  const out = await $.command.run({ command: 'sdd-status', args: 'refresh' })
  expect(out.text).toContain('Phase: unknown')
  expect(state['sdd-phase-tracker.capability'].status).toBe('degraded')
})

test('/sdd-status reset needs confirmation and touches no Spec-Kit file', async ($: any, on: any) => {
  const state: Record<string, any> = {}
  const writes: string[] = []
  on('session.root', async () => ({ value: '/proj' }))
  on('clock.now', async () => ({ value: 5 }))
  on('fs.write', async (_$: any, e: any) => { writes.push(e.path); return { value: undefined } })
  on('state.set', async (_$: any, e: any) => { state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$: any, e: any) => ({ result: { questions: e.questions, answers: { [e.questions[0].question]: 'No' } } }))
  const out = await $.command.run({ command: 'sdd-status', args: 'reset' })
  expect(out.text).toContain('Not reset'); expect(writes).toEqual([]); expect(state['sdd-phase-tracker.phase']).toBeUndefined()
})
