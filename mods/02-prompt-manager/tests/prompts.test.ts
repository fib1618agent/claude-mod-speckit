import { test, expect } from 'claude-code/testing'
import { compose, editMarker, isInsideModDir, isSafePhase, parseEditDraft, parseTemplate, stripFrontmatter } from '../hooks/lib/prompts'

test('parseTemplate: pack header gives version and access; project template without header is "project"', () => {
  const p = parseTemplate('<!-- sdd-pack: phase=analyze version=3 access=read-only -->\n# body', 'analyze')
  expect(p.version).toBe('3'); expect(p.access).toBe('read-only'); expect(p.error).toBeUndefined()
  const q = parseTemplate('just text', 'plan')
  expect(q.version).toBe('project'); expect(q.access).toBe('unknown')
})

test('parseTemplate: malformed (wrong phase, empty) is an error, not a silent pass', () => {
  expect(parseTemplate('<!-- sdd-pack: phase=plan version=1 -->\nx', 'tasks').error).toContain('phase "plan"')
  expect(parseTemplate('   \n', 'plan').error).toBe('template is empty')
  expect(parseTemplate('<!-- sdd-pack: phase=plan version=1 -->\n', 'plan').error).toBe('template is empty')
})

test('compose: layers are numbered in precedence order and labeled official vs not official', () => {
  const out = compose({
    phase: 'plan', upstream: { id: 'speckit-plan', text: 'UP' }, policy: { id: 'policy.md', text: 'POL' },
    template: { source: 'project-template', id: 'project-template:plan', version: '2', text: 'TPL' },
    context: 'CTX', artifacts: 'ART', args: 'ARGS', oneTime: 'ONCE',
  })
  const order = ['Layer 1', 'Layer 2', 'Layer 3', 'Layer 4', 'Layer 5', 'Layer 6', 'Layer 7'].map(s => out.text.indexOf(s))
  expect(order.every((n, i) => n >= 0 && (i === 0 || n > order[i - 1]!))).toBe(true)
  expect(out.layers.map(l => l.source)).toEqual(['upstream', 'policy', 'project-template', 'context', 'artifacts', 'arguments', 'one-time'])
  expect(out.text).toContain('official text')
  expect(out.text).toContain('NOT official Spec-Kit text')
})

test('compose: empty optional layers are omitted, not invented', () => {
  const out = compose({ phase: 'plan', template: { source: 'pack-default', id: 'pack:plan', version: '1', text: 'T' }, context: '', artifacts: '', args: '', oneTime: '' })
  expect(out.layers.map(l => l.source)).toEqual(['pack-default'])
})

test('safety helpers', () => {
  expect(isSafePhase('plan')).toBe(true)
  for (const bad of ['../x', 'a/b', 'Plan', '', 'a.b']) expect(isSafePhase(bad)).toBe(false)
  expect(isInsideModDir('/p', '/p/.speckit/mod/prompts/plan.md')).toBe(true)
  expect(isInsideModDir('/p', '/p/.speckit/mod/../../etc/passwd')).toBe(false)
  expect(isInsideModDir('/p', '/p/src/a.ts')).toBe(false)
  expect(stripFrontmatter('---\nname: x\n---\nBODY')).toBe('BODY')
})

test('edit marker round-trips and ignores normal prompts', () => {
  const d = parseEditDraft(`${editMarker('plan')}\nnew body`)
  expect(d).toEqual({ phase: 'plan', body: 'new body' })
  expect(parseEditDraft('hello world')).toBe(null)
})
