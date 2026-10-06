import type { Register } from 'claude-code'
import type { Artifacts } from '../types'
import { fingerprint, projectKey } from './shared/fingerprint'
import { parseConfig, section, list } from './shared/config'
import { ARTIFACT_MODEL, IMPLEMENTATION_MODEL, buildItems, formatMatrix, pickFeature, staleIds, type Fact } from './lib/inventory'

const ARTIFACTS = { plugin: 'sdd-artifact-tracker', key: 'artifacts' } as const
const CAPABILITY = { plugin: 'sdd-artifact-tracker', key: 'capability' } as const
const NAV_VIEW = { plugin: 'sdd-navigator', key: 'view' } as const
const MAX_HASH_BYTES = 1_000_000

async function factFor($: any, path: string): Promise<Fact> {
  let st: any
  try { st = await $.fs.stat(path) } catch { return { path, status: 'missing', mtime: 0, size: 0, hash: '' } }
  if (st.kind !== 'file') return { path, status: 'missing', mtime: 0, size: 0, hash: '' }
  try {
    // Metadata and a fingerprint only: file contents are read to hash and never stored.
    const hash = st.size > MAX_HASH_BYTES ? fingerprint(`size:${st.size}:mtime:${st.mtimeMs}`) : fingerprint(String(await $.fs.read(path)))
    return { path, status: 'present', mtime: st.mtimeMs, size: st.size, hash }
  } catch { return { path, status: 'unreadable', mtime: st.mtimeMs, size: st.size, hash: '' } }
}

async function newestMarkdown($: any, dir: string): Promise<string | undefined> {
  try {
    const entries: any[] = await $.fs.list(dir)
    const md = entries.filter(x => x.kind === 'file' && x.name.endsWith('.md')).sort((a, b) => b.mtimeMs - a.mtimeMs)
    return md.length ? `${dir}/${md[0].name}` : undefined
  } catch { return undefined }
}

async function configText($: any, root: string): Promise<string> {
  const p = `${root}/.speckit/mod/config.yaml`
  try { return (await $.fs.exists(p)) ? String(await $.fs.read(p)) : '' } catch { return '' }
}

async function implementationFact($: any, root: string, paths: string[]): Promise<Fact> {
  let newest = 0
  const parts: string[] = []
  for (const rel of paths) {
    try { const st = await $.fs.stat(`${root}/${rel}`); newest = Math.max(newest, st.mtimeMs); parts.push(`${rel}:${st.size}:${st.mtimeMs}`) } catch { parts.push(`${rel}:missing`) }
  }
  return newest ? { path: paths.join(','), status: 'present', mtime: newest, size: parts.length, hash: fingerprint(parts.join('|')) } : { path: paths.join(','), status: 'missing', mtime: 0, size: 0, hash: '' }
}

async function scan($: any): Promise<Artifacts> {
  const root: string = await $.session.root()
  const at: number = await $.clock.now()
  if (!(await $.fs.exists(`${root}/.specify`))) return { items: [], feature: null, isSpecKit: false, at }
  const cfg = section(parseConfig(await configText($, root)), 'artifacts')
  let dirs: { name: string; mtimeMs: number }[] = []
  try { dirs = (await $.fs.list(`${root}/specs`)).filter((x: any) => x.kind === 'dir') } catch { /* no specs dir yet */ }
  const feature = pickFeature(dirs, cfg.feature)
  const facts: Record<string, Fact | undefined> = {}
  facts.constitution = await factFor($, `${root}/.specify/memory/constitution.md`)
  if (feature) {
    const dir = `${root}/specs/${feature}`
    facts.spec = await factFor($, `${dir}/spec.md`)
    facts.plan = await factFor($, `${dir}/plan.md`)
    facts.tasks = await factFor($, `${dir}/tasks.md`)
    const cl = await newestMarkdown($, `${dir}/checklists`)
    facts.checklist = cl ? await factFor($, cl) : undefined
  }
  const models = [...ARTIFACT_MODEL]
  const impl = list(cfg.implementation)
  if (impl.length) { facts.implementation = await implementationFact($, root, impl); models.push(IMPLEMENTATION_MODEL) }
  // $.store is per plugin and per user: the previous-hash cache is keyed by project.
  const key = 'hashes:' + projectKey(root)
  const previous = ((await $.store.get(key)) as Record<string, string> | undefined) ?? {}
  const items = buildItems(models, facts, previous)
  await $.store.set(key, Object.fromEntries(items.filter(i => i.exists).map(i => [i.id, i.hash])))
  return { items, feature, isSpecKit: true, at }
}

async function refresh($: any): Promise<Artifacts | undefined> {
  try {
    const inv = await scan($)
    await $.state.set(ARTIFACTS, inv)
    await $.state.set(CAPABILITY, { id: 'artifacts', version: '0.1.0', status: 'ready' })
    return inv
  } catch (err: any) {
    await $.state.set(CAPABILITY, { id: 'artifacts', version: '0.1.0', status: 'degraded', reason: String(err?.message ?? err).slice(0, 160) })
    return undefined
  }
}

async function navValue($: any) {
  return (await $.state.get(NAV_VIEW)).value
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sdd-artifacts', description: 'Show the SDD artifact inventory and freshness', argumentHint: '[refresh]' })
    await refresh($)
    return next(e)
  })

  on('command.run', { command: 'sdd-artifacts' }, async $ => {
    const inv = await refresh($)
    if (!inv) return { text: 'Artifact Tracker degraded: inventory could not be read.' }
    if (!inv.isSpecKit) return { text: 'Not a Spec-Kit project (no .specify directory): no artifacts to track.' }
    const stale = staleIds(inv.items)
    return { text: `Feature: ${inv.feature ?? 'none'}\n${formatMatrix(inv.items)}${stale.length ? `\nSTALE: ${stale.join(', ')}` : ''}` }
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.tool === 'Write' || e.tool === 'Edit' || e.tool === 'NotebookEdit') await refresh($)
    return ran
  })

  // Contextual view for the Navigator's view slot: answer only for our own activeView; otherwise pass the draw through.
  on('ui.render', { component: 'Pane', requestId: ['sdd', 'sdd-view'] }, async ($, e, next) => {
    const nav = await navValue($)
    if (nav?.activeView !== 'artifacts' || (e.requestId === 'sdd' && nav.mode === 'panes')) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const inv = (await $.state.get(ARTIFACTS)).value
    const items = inv?.items ?? []
    return (
      <Box flexDirection="column">
        <Text bold>SDD / ARTIFACTS</Text>
        {!inv && <Text dimColor>No inventory yet.</Text>}
        {inv && !inv.isSpecKit && <Text dimColor>No Spec-Kit artifacts found (no .specify directory).</Text>}
        {items.map(i => (
          <Text key={i.id}>{`${i.id.padEnd(14)} ${i.exists ? 'present' : 'missing'}  ${i.fresh === 'stale' ? 'STALE ⏳' : i.fresh === 'fresh' ? 'fresh ✓' : 'unknown ?'}  ${i.producedBy}`}</Text>
        ))}
        <Button key="artifacts-refresh" label="Refresh" hotkey="r" onPress={() => refresh($)} />
      </Box>
    )
  })
}
