import type { Register } from 'claude-code'
import type { ConvergenceException } from '../types'
import { projectKey } from './shared/fingerprint'
import { formatConvergence, deriveConvergence, looksLikeCheck, parseTasks, validateException, type Checks } from './lib/converge'

const CONVERGENCE = { plugin: 'sdd-convergence-tracker', key: 'convergence' } as const
const CAPABILITY = { plugin: 'sdd-convergence-tracker', key: 'capability' } as const
const ARTIFACTS = { plugin: 'sdd-artifact-tracker', key: 'artifacts' } as const
const ANALYZE = { plugin: 'sdd-analyze-gate', key: 'analyze' } as const
const QUALITY = { plugin: 'sdd-quality-gate', key: 'quality' } as const
const TRACE = { plugin: 'sdd-traceability', key: 'trace' } as const
const NAV_VIEW = { plugin: 'sdd-navigator', key: 'view' } as const

let checks: Checks = 'unknown'
let exceptions: ConvergenceException[] = []

async function key($: any): Promise<string> { return 'converge:' + projectKey(await $.session.root()) }

async function restore($: any): Promise<void> {
  const saved = (await $.store.get(await key($))) as { exceptions?: ConvergenceException[] } | undefined
  exceptions = saved?.exceptions ?? []
}

async function recompute($: any): Promise<void> {
  const artifacts = (await $.state.get(ARTIFACTS)).value
  let tasksText = ''
  const path = artifacts?.items?.find((x: any) => x.id === 'tasks')?.path
  if (path) { try { tasksText = String(await $.fs.read(path)) } catch { /* unreadable: zero tasks => NOT_STARTED, never CONVERGED */ } }
  const previous = (await $.state.get(CONVERGENCE)).value?.state
  const c = deriveConvergence({
    tasks: parseTasks(tasksText), artifacts, analyze: (await $.state.get(ANALYZE)).value, trace: (await $.state.get(TRACE)).value,
    quality: (await $.state.get(QUALITY)).value, checks, exceptions, previous, at: await $.clock.now(),
  })
  await $.state.set(CONVERGENCE, c)
  await $.state.set(CAPABILITY, artifacts ? { id: 'converge', version: '0.1.0', status: 'ready' } : { id: 'converge', version: '0.1.0', status: 'degraded', reason: 'no artifact inventory: convergence cannot exceed NOT_STARTED' })
}

// Never runs Analyze: it hands the request to 03, where a person reviews and approves. Deferred, never inside an awaited hook.
async function requestReanalyze($: any): Promise<void> {
  try { await $.command.run({ command: 'sdd-run', args: 'analyze' }) }
  catch (err: any) { $.ui.toast('Re-analysis not requested: the Review Gate (sdd-run) is unavailable. ' + String(err?.message ?? err).slice(0, 80)) }
}

async function confirm($: any, question: string): Promise<boolean> {
  try { return (await $.ui.ask(question, ['Yes', 'No'])) === 'Yes' } catch { return false }
}

async function markException($: any, scope: string, reason: string): Promise<string> {
  const bad = validateException(scope, reason)
  if (bad) return `Not recorded: ${bad}. Usage: /sdd-converge except <scope> <reason>`
  if (!(await confirm($, `Record a convergence exception for "${scope}": ${reason.slice(0, 120)}? This waives that evidence requirement and is recorded.`))) return 'Not recorded (no confirmation).'
  const ex: ConvergenceException = { id: `X${exceptions.length + 1}`, scope, reason: reason.trim(), at: await $.clock.now() }
  exceptions = [...exceptions, ex]
  await $.store.set(await key($), { exceptions })
  await recompute($)
  return `Exception ${ex.id} recorded for "${scope}". It is metadata only; no artifact was changed.`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sdd-converge', description: 'Show convergence; request re-analysis; record an exception', argumentHint: '[reanalyze | except <scope> <reason>]' })
    await restore($)
    await recompute($)
    return next(e)
  })

  on('command.run', { command: 'sdd-converge' }, async ($, e) => {
    const [sub = '', scope = '', ...reason] = (e.args ?? '').trim().split(/\s+/)
    if (sub === 'reanalyze') {
      $.clock.after(0, () => requestReanalyze($))
      return { text: 'Requested re-analysis through the Review Gate: review and approve there. Convergence does not run Analyze itself.' }
    }
    if (sub === 'except') return { text: await markException($, scope, reason.join(' ')) }
    await recompute($)
    return { text: formatConvergence((await $.state.get(CONVERGENCE)).value) }
  })

  // Best-effort: observe test/check commands the session ran (Bash only). Unknown stays unknown.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.tool === 'Bash' && looksLikeCheck(String((e as { command?: string }).command ?? ''))) {
      checks = ran.deny === undefined && ran.isError !== true ? 'passing' : 'failing'
      await recompute($)
    }
    return ran
  })

  on('state.set', { plugin: 'sdd-artifact-tracker', key: 'artifacts' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('state.set', { plugin: 'sdd-analyze-gate', key: 'analyze' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('state.set', { plugin: 'sdd-quality-gate', key: 'quality' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('state.set', { plugin: 'sdd-traceability', key: 'trace' }, async ($, e, next) => { const r = await next(e); await recompute($); return r })
  on('turn.complete', async ($, e, next) => { await recompute($); return next(e) })

  on('ui.render', { component: 'Pane', requestId: ['sdd', 'sdd-view'] }, async ($, e, next) => {
    const nav = (await $.state.get(NAV_VIEW)).value
    if (nav?.activeView !== 'converge' || (e.requestId === 'sdd' && nav.mode === 'panes')) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const c = (await $.state.get(CONVERGENCE)).value
    return (
      <Box flexDirection="column">
        <Text bold>SDD / CONVERGENCE</Text>
        {formatConvergence(c).split('\n').map((l, n) => <Text key={String(n)}>{l}</Text>)}
        <Text dimColor>Gate decisions (approve / continue): ⑥ Quality. Exceptions: /sdd-converge except &lt;scope&gt; &lt;reason&gt;</Text>
        <Button key="converge-review" label="Review" hotkey="r" onPress={() => recompute($)} />
        <Button key="converge-reanalyze" label="Request re-analyze" hotkey="a" onPress={() => requestReanalyze($)} />
      </Box>
    )
  })
}
