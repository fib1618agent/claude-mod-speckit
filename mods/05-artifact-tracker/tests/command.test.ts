import { test, expect } from 'claude-code/testing'

// A tiny fake project: path -> { mtime, text }. Mocks sit beneath the plugin, standing in for the engine.
function fakeEnv(on: any, files: Record<string, { mtime: number; text: string }>, dirs: Record<string, { name: string; mtimeMs: number }[]>, isSpecKit = true) {
  const state: Record<string, any> = {}
  const store: Record<string, any> = {}
  const writes: string[] = []
  on('session.root', async () => ({ value: '/proj' }))
  on('clock.now', async () => ({ value: 1000 }))
  on('fs.exists', async (_$: any, e: any) => ({ value: (isSpecKit && e.path === '/proj/.specify') || e.path in files }))
  on('fs.stat', async (_$: any, e: any) => {
    const f = files[e.path]
    if (!f) throw new Error('ENOENT')
    return { value: { kind: 'file', size: f.text.length, mtimeMs: f.mtime, isLink: false } }
  })
  on('fs.read', async (_$: any, e: any) => ({ value: files[e.path]?.text ?? '' }))
  on('fs.list', async (_$: any, e: any) => {
    const d = dirs[e.path]
    if (!d) throw new Error('ENOENT')
    return { value: d.map(x => ({ name: x.name, kind: x.name.endsWith('.md') ? 'file' : 'dir', size: 1, mtimeMs: x.mtimeMs, isLink: false })) }
  })
  on('fs.write', async (_$: any, e: any) => { writes.push(e.path); return { value: undefined } })
  on('store.get', async (_$: any, e: any) => ({ value: store[e.key] }))
  on('store.set', async (_$: any, e: any) => { store[e.key] = e.value; return { value: undefined } })
  on('state.get', async (_$: any, e: any) => ({ value: { value: state[e.plugin + '.' + e.key], version: 1 } }))
  on('state.set', async (_$: any, e: any) => { state[e.plugin + '.' + e.key] = e.value; return { value: { isSet: true, version: 1 } } })
  on('command.register', async (_$: any, e: any) => ({ value: { command: e.name } }))
  return { state, store, writes }
}

test('/sdd-artifacts reports stale plan and writes nothing to the project', async ($: any, on: any) => {
  const env = fakeEnv(on, {
    '/proj/.specify/memory/constitution.md': { mtime: 1, text: 'c' },
    '/proj/specs/001-a/spec.md': { mtime: 50, text: 'spec' },
    '/proj/specs/001-a/plan.md': { mtime: 20, text: 'plan' },
  }, { '/proj/specs': [{ name: '001-a', mtimeMs: 5 }], '/proj/specs/001-a/checklists': [] })
  const out = await $.command.run({ command: 'sdd-artifacts' })
  expect(out.text).toContain('Feature: 001-a')
  expect(out.text).toContain('STALE: plan')
  expect(env.state['sdd-artifact-tracker.artifacts'].items.find((i: any) => i.id === 'plan').fresh).toBe('stale')
  expect(env.writes).toEqual([]) // Artifact Tracker never modifies project files
})

test('not a Spec-Kit project: explicit message, empty inventory', async ($: any, on: any) => {
  const env = fakeEnv(on, {}, {}, false)
  const out = await $.command.run({ command: 'sdd-artifacts' })
  expect(out.text).toContain('Not a Spec-Kit project')
  expect(env.state['sdd-artifact-tracker.artifacts'].items).toEqual([])
})
