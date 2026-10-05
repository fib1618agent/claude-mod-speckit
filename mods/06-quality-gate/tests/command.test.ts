import { test, expect } from 'claude-code/testing'

function env(on: any, answer: 'Yes' | 'No') {
  const state: Record<string, any> = {}; const store: Record<string, any> = {}
  state['sdd-artifact-tracker.artifacts'] = { items: ['constitution', 'spec', 'plan'].map(id => ({ id, exists: true, hash: 'h-' + id, mtime: 1, producedBy: id, dependsOn: [], fresh: 'fresh', status: 'present' })), feature: 'f', isSpecKit: true, at: 1 }
  on('session.root', async () => ({ value: '/proj' })); on('clock.now', async () => ({ value: 3 }))
  on('fs.exists', async () => ({ value: false })); on('fs.list', async () => { throw new Error('ENOENT') })
  on('state.get', async (_$: any, e: any) => ({ value: { value: state[e.plugin + '.' + e.key], version: 1 } }))
  on('state.set', async (_$: any, e: any) => { state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  on('store.get', async (_$: any, e: any) => ({ value: store[e.key] })); on('store.set', async (_$: any, e: any) => { store[e.key] = e.value; return { value: undefined } })
  on('command.register', async (_$: any, e: any) => ({ value: { command: e.name } }))
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$: any, e: any) => ({ result: { questions: e.questions, answers: { [e.questions[0].question]: answer } } }))
  return { state, store }
}

test('/sdd-quality prints gate statuses and never an invented percentage', async ($: any, on: any) => {
  env(on, 'Yes')
  const out = await $.command.run({ command: 'sdd-quality', args: 'plan' })
  expect(out.text).toContain('READY'); expect(out.text).not.toMatch(/\d+\s*%/)
})

test('approve needs explicit confirmation: declined records nothing', async ($: any, on: any) => {
  const e = env(on, 'No')
  const out = await $.command.run({ command: 'sdd-quality', args: 'approve plan' })
  expect(out.text).toContain('no confirmation'); expect(Object.keys(e.store)).toEqual([])
})

test('approve with confirmation is recorded (project-keyed) and bound to the evidence', async ($: any, on: any) => {
  const e = env(on, 'Yes')
  const out = await $.command.run({ command: 'sdd-quality', args: 'approve plan' })
  expect(out.text).toContain('approved recorded')
  const key = Object.keys(e.store)[0]!
  expect(key).toMatch(/^approvals:p-/); expect(e.store[key].plan.decision).toBe('approved'); expect(e.store[key].plan.evidenceKey).toBeTruthy()
})

test('an unknown phase cannot be approved', async ($: any, on: any) => {
  const e = env(on, 'Yes')
  expect((await $.command.run({ command: 'sdd-quality', args: 'approve nonsense' })).text).toContain('Not recorded')
  expect(Object.keys(e.store)).toEqual([])
})
