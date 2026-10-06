import { test, expect } from 'claude-code/testing'
import { ARTIFACT_MODEL, IMPLEMENTATION_MODEL, buildItems, formatMatrix, featureFromJson, freshness, pickFeature, staleIds, type Fact } from '../hooks/lib/inventory'

const f = (path: string, mtime: number, hash = 'h' + mtime, status: Fact['status'] = 'present'): Fact => ({ path, status, mtime, size: 10, hash })
const byId = (items: ReturnType<typeof buildItems>, id: string) => items.find(i => i.id === id)!

test('fresh when every dependency is not newer', () => {
  const items = buildItems(ARTIFACT_MODEL, { constitution: f('c', 1), spec: f('s', 10), plan: f('p', 20), tasks: f('t', 30), checklist: f('k', 25) }, {})
  expect(byId(items, 'plan').fresh).toBe('fresh')
  expect(byId(items, 'tasks').fresh).toBe('fresh')
  expect(staleIds(items)).toEqual([])
})

test('stale: spec changed after plan', () => {
  const items = buildItems(ARTIFACT_MODEL, { spec: f('s', 50), plan: f('p', 20), tasks: f('t', 30) }, {})
  expect(byId(items, 'plan').fresh).toBe('stale')
  expect(staleIds(items)).toContain('plan')
})

test('stale: plan changed after tasks', () => {
  const items = buildItems(ARTIFACT_MODEL, { spec: f('s', 1), plan: f('p', 40), tasks: f('t', 30) }, {})
  expect(byId(items, 'tasks').fresh).toBe('stale')
})

test('stale: implementation changed after tasks becomes visible when configured', () => {
  const items = buildItems([...ARTIFACT_MODEL, IMPLEMENTATION_MODEL], { spec: f('s', 1), plan: f('p', 2), tasks: f('t', 3), implementation: f('src', 99) }, {})
  expect(byId(items, 'implementation').fresh).toBe('fresh') // implementation is the newest: it depends on tasks and is later
  const older = buildItems([...ARTIFACT_MODEL, IMPLEMENTATION_MODEL], { spec: f('s', 1), plan: f('p', 2), tasks: f('t', 100), implementation: f('src', 50) }, {})
  expect(byId(older, 'implementation').fresh).toBe('stale')
})

test('missing artifact: exists false, fresh unknown, never fresh by existence alone', () => {
  const items = buildItems(ARTIFACT_MODEL, { spec: f('s', 1) }, {})
  expect(byId(items, 'plan').exists).toBe(false)
  expect(byId(items, 'plan').fresh).toBe('unknown')
  expect(byId(items, 'tasks').fresh).toBe('unknown')
})

test('unreadable artifact is unknown, not stale and not fresh', () => {
  expect(freshness(f('p', 5, '', 'unreadable'), [])).toBe('unknown')
  const items = buildItems(ARTIFACT_MODEL, { spec: f('s', 1), plan: f('p', 5, '', 'unreadable') }, {})
  expect(byId(items, 'plan').exists).toBe(false)
  expect(byId(items, 'plan').status).toBe('unreadable')
  expect(byId(items, 'plan').fresh).toBe('unknown')
})

test('modified / regenerated detection uses previous hashes and ignores deleted artifacts', () => {
  const items = buildItems(ARTIFACT_MODEL, { spec: f('s', 9, 'new'), plan: f('p', 9, 'same') }, { spec: 'old', plan: 'same', tasks: 'gone' })
  expect(byId(items, 'spec').changed).toBe(true)
  expect(byId(items, 'plan').changed).toBe(false)
  expect(byId(items, 'tasks').exists).toBe(false)
  expect(byId(items, 'tasks').changed).toBe(false)
})

test('multiple feature directories: newest wins, override wins over newest', () => {
  const dirs = [{ name: '001-a', mtimeMs: 1 }, { name: '002-b', mtimeMs: 5 }]
  expect(pickFeature(dirs)).toBe('002-b')
  expect(pickFeature(dirs, '001-a')).toBe('001-a')
  expect(pickFeature([])).toBe(null)
})

test('feature.json picks the active feature; override beats it; a missing dir or bad JSON falls back to newest', () => {
  const dirs = [{ name: '001-a', mtimeMs: 9 }, { name: '006-b', mtimeMs: 1 }]
  expect(featureFromJson('{"feature_directory": "specs/006-b/"}')).toBe('006-b')
  expect(pickFeature(dirs, undefined, '006-b')).toBe('006-b')
  expect(pickFeature(dirs, '001-a', '006-b')).toBe('001-a')
  expect(pickFeature(dirs, undefined, '009-gone')).toBe('001-a')
  expect(featureFromJson('not json')).toBe(undefined)
  expect(featureFromJson('{}')).toBe(undefined)
  expect(featureFromJson(undefined)).toBe(undefined)
})

test('only metadata: items never carry file contents', () => {
  const items = buildItems(ARTIFACT_MODEL, { spec: f('s', 1) }, {})
  expect(Object.keys(byId(items, 'spec')).sort()).toEqual(['changed', 'dependsOn', 'exists', 'fresh', 'hash', 'id', 'mtime', 'path', 'producedBy', 'size', 'status'])
})

test('matrix text has the required columns and an empty fallback', () => {
  expect(formatMatrix([])).toBe('No Spec-Kit artifacts found.')
  const text = formatMatrix(buildItems(ARTIFACT_MODEL, { spec: f('s', 1) }, {}))
  expect(text.split('\n')[0]).toContain('Artifact')
  expect(text.split('\n')[0]).toContain('Source Phase')
})
