import type { Register } from 'claude-code'
import { parseConfig, section, list } from './shared/config'
import { analyzeTrace, formatTrace } from './lib/trace'

const TRACE = { plugin: 'sdd-traceability', key: 'trace' } as const
const CAPABILITY = { plugin: 'sdd-traceability', key: 'capability' } as const
const ARTIFACTS = { plugin: 'sdd-artifact-tracker', key: 'artifacts' } as const
const NAV_VIEW = { plugin: 'sdd-navigator', key: 'view' } as const
const MAX_TEXT = 400_000

async function readText($: any, path: string | undefined): Promise<string> {
  if (!path) return ''
  try { const st = await $.fs.stat(path); if (st.kind !== 'file' || st.size > MAX_TEXT) return ''; return String(await $.fs.read(path)) } catch { return '' }
}

async function cfgOf($: any, root: string): Promise<Record<string, string>> {
  try { const p = `${root}/.speckit/mod/config.yaml`; return section(parseConfig((await $.fs.exists(p)) ? String(await $.fs.read(p)) : ''), 'trace') } catch { return {} }
}

async function dirFiles($: any, root: string, rel: string, ext: RegExp): Promise<string[]> {
  try { return (await $.fs.list(`${root}/${rel}`)).filter((x: any) => x.kind === 'file' && ext.test(x.name)).slice(0, 200).map((x: any) => `${rel}/${x.name}`) } catch { return [] }
}

async function recompute($: any): Promise<void> {
  const inv = (await $.state.get(ARTIFACTS)).value
  const root: string = await $.session.root()
  const at: number = await $.clock.now()
  if (!inv) {
    await $.state.set(CAPABILITY, { id: 'trace', version: '0.1.0', status: 'degraded', reason: 'Artifact Tracker (05) unavailable: sources cannot be located' })
    return
  }
  const path = (id: string) => inv.items.find((i: any) => i.id === id)?.path as string | undefined
  const cfg = await cfgOf($, root)
  const tests: { path: string; text: string }[] = []
  for (const dir of list(cfg.tests)) for (const f of await dirFiles($, root, dir, /\.(test|spec)\.[jt]sx?$|_test\.py$|^test_.*\.py$/)) tests.push({ path: f, text: await readText($, `${root}/${f}`) })
  const impl: string[] = []
  for (const dir of list(cfg.implementation)) impl.push(...(await dirFiles($, root, dir, /\.[a-z]+$/)))
  const trace = analyzeTrace({
    specText: await readText($, path('spec')), planText: await readText($, path('plan')), tasksText: await readText($, path('tasks')),
    tests, implementation: impl, reqPattern: cfg.requirementPattern, at,
  })
  await $.state.set(TRACE, trace)
  await $.state.set(CAPABILITY, { id: 'trace', version: '0.1.0', status: 'ready' })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sdd-trace', description: 'Show requirement traceability and gaps', argumentHint: '[refresh]' })
    await recompute($)
    return next(e)
  })
  on('command.run', { command: 'sdd-trace' }, async $ => {
    await recompute($)
    const t = (await $.state.get(TRACE)).value
    return { text: t ? formatTrace(t) : 'Traceability unavailable: no artifact inventory from the Artifact Tracker.' }
  })
  on('state.set', { plugin: 'sdd-artifact-tracker', key: 'artifacts' }, async ($, e, next) => {
    const ran = await next(e)
    await recompute($)
    return ran
  })
  on('turn.complete', async ($, e, next) => { await recompute($); return next(e) })

  on('ui.render', { component: 'Pane', requestId: ['sdd', 'sdd-view'] }, async ($, e, next) => {
    const nav = (await $.state.get(NAV_VIEW)).value
    if (nav?.activeView !== 'trace' || (e.requestId === 'sdd' && nav.mode === 'panes')) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const t = (await $.state.get(TRACE)).value
    return (
      <Box flexDirection="column">
        <Text bold>SDD / TRACE</Text>
        {!t && <Text dimColor>No traceability data.</Text>}
        {t && formatTrace(t).split('\n').slice(0, 40).map((l, n) => <Text key={String(n)}>{l}</Text>)}
        <Button key="trace-rerun" label="Re-run" hotkey="r" onPress={() => recompute($)} />
      </Box>
    )
  })
}
