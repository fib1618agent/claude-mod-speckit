import type { Register } from 'claude-code'
import { projectKey } from './shared/fingerprint'
import { REVIEW_PLUGIN, buildResult, formatFindings, formatResult, isMutating, parseReport, reviewedPhase, staleness } from './lib/analyze'

const ANALYZE = { plugin: 'sdd-analyze-gate', key: 'analyze' } as const
const CAPABILITY = { plugin: 'sdd-analyze-gate', key: 'capability' } as const
const ARTIFACTS = { plugin: 'sdd-artifact-tracker', key: 'artifacts' } as const
const TRACE = { plugin: 'sdd-traceability', key: 'trace' } as const
const NAV_VIEW = { plugin: 'sdd-navigator', key: 'view' } as const

// Run tracking is this Mod's own state (a module variable): it is NOT shared state and 04 never reads `review`.
// 'running' = an approved, reviewed Analyze submission was observed and its turn has not completed.
let run: 'idle' | 'requested' | 'running' = 'idle'

async function currentHashes($: any): Promise<Record<string, string> | undefined> {
  const inv = (await $.state.get(ARTIFACTS)).value
  if (!inv) return undefined
  return Object.fromEntries(inv.items.filter((i: any) => i.exists).map((i: any) => [i.id, i.hash]))
}

async function storeKey($: any): Promise<string> { return 'analyze:' + projectKey(await $.session.root()) }

async function restore($: any): Promise<void> {
  const saved = await $.store.get(await storeKey($))
  if (saved) await $.state.set(ANALYZE, saved)
}

// Delegation, never execution: 03 composes, reviews and asks for approval. Called from a Button press or a deferred timer,
// never from inside the awaited command.run hook (the engine rejects that).
async function requestRun($: any): Promise<void> {
  run = 'requested'
  try { await $.command.run({ command: 'sdd-run', args: 'analyze' }) }
  catch (err: any) {
    run = 'idle'
    $.ui.toast('Analyze not started: the Review Gate (sdd-run) is unavailable. ' + String(err?.message ?? err).slice(0, 80))
  }
}

async function statusText($: any, withFindings: boolean): Promise<string> {
  const r = (await $.state.get(ANALYZE)).value
  const st = staleness(r, await currentHashes($))
  const trace = (await $.state.get(TRACE)).value
  const extra = trace ? `\nTraceability evidence: ${trace.status}, ${trace.gaps.length} gap(s)` : ''
  return formatResult(r, st) + extra + (withFindings ? '\n\n' + formatFindings(r) : '')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sdd-analyze', description: 'Show Analyze results; "run" requests a reviewed read-only Analyze', argumentHint: '[run|findings]' })
    await restore($)
    await $.state.set(CAPABILITY, { id: 'analyze', version: '0.1.0', status: 'ready' })
    return next(e)
  })

  on('command.run', { command: 'sdd-analyze' }, async ($, e) => {
    const arg = (e.args ?? '').trim()
    if (arg === 'run') {
      $.clock.after(0, () => requestRun($))
      return { text: 'Requested Analyze through the Review Gate: review and approve the prompt there. (Analyze never runs without that approval.)' }
    }
    return { text: await statusText($, arg === 'findings') }
  })

  // Arms the read-only guard from the approved reviewed submission: plugin-origin, submitted by the Review Gate, for phase analyze.
  // The submitting plugin's own hooks are skipped, which is why 03 and 04 are separate plugins.
  on('prompt.submit', { origin: { kind: 'plugin' } }, async ($, e, next) => {
    const o = e.origin as { kind: string; name?: string } | undefined
    if (o?.kind === 'plugin' && o.name === REVIEW_PLUGIN && reviewedPhase(e.text) === 'analyze') run = 'running'
    else if (run === 'requested' && o && o.kind !== 'plugin') run = 'idle' // a human moved on without approving
    return next(e)
  })

  // BEST-EFFORT read-only guard. Not a sandbox: Bash mutation detection is heuristic and MCP/other tools are not covered.
  on('tool.call', async ($, e, next) => {
    if (run === 'running' && isMutating(String(e.tool), e as { command?: string })) {
      return { deny: `Analyze is read-only: ${String(e.tool)} was blocked (best-effort guard). Report the finding instead of fixing it.` }
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (run === 'running' && !e.agentId) { // a subagent's turn is not the end of the reviewed run
      run = 'idle'
      if (e.reason === 'answer') {
        const result = buildResult(parseReport(e.answer), (await currentHashes($)) ?? {}, await $.clock.now())
        await $.state.set(ANALYZE, result)
        await $.store.set(await storeKey($), result)
        if (result.overall === 'UNKNOWN') $.ui.toast('Analyze finished but its sdd-findings report could not be parsed: no result recorded as READY.')
      }
    }
    return done
  })

  on('ui.render', { component: 'Pane', requestId: ['sdd', 'sdd-view'] }, async ($, e, next) => {
    const nav = (await $.state.get(NAV_VIEW)).value
    if (nav?.activeView !== 'analyze' || (e.requestId === 'sdd' && nav.mode === 'panes')) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const r = (await $.state.get(ANALYZE)).value
    const lines = (await statusText($, true)).split('\n')
    return (
      <Box flexDirection="column">
        <Text bold>SDD / ANALYZE</Text>
        {lines.map((l, n) => <Text key={String(n)}>{l}</Text>)}
        <Text dimColor>Prompt: ② · Review and approval: ③ · Gate decision: ⑥</Text>
        <Button key="analyze-run" label={r ? 'Re-run Analyze' : 'Run Analyze'} hotkey="r" variant="primary" onPress={() => requestRun($)} />
      </Box>
    )
  })
}
