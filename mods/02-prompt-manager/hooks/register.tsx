import type { Register } from 'claude-code'
import type { PromptResolution } from '../types'
import { fingerprint } from './shared/fingerprint'
import { parseConfig, section, bool } from './shared/config'
import { resolvePhaseModel } from './shared/phases'
import { compose, editMarker, isInsideModDir, isSafePhase, parseEditDraft, parseTemplate, preview, stripFrontmatter } from './lib/prompts'

const RESOLUTION = { plugin: 'sdd-prompt-manager', key: 'promptResolution' } as const
const CAPABILITY = { plugin: 'sdd-prompt-manager', key: 'capability' } as const
const NAV_VIEW = { plugin: 'sdd-navigator', key: 'view' } as const
const ARTIFACTS = { plugin: 'sdd-artifact-tracker', key: 'artifacts' } as const
const PHASE = { plugin: 'sdd-phase-tracker', key: 'phase' } as const

// Transient edit drafts (module variable: lost on hot reload by design; nothing is saved without an explicit Save).
const drafts: Record<string, string> = {}

type Found = { source: 'project-template' | 'global-template' | 'pack-default'; id: string; version: string; text: string; access: string } | { error: string }

async function readIfExists($: any, path: string): Promise<string | undefined> {
  try { return (await $.fs.exists(path)) ? String(await $.fs.read(path)) : undefined } catch { return undefined }
}

async function configOf($: any, root: string): Promise<Record<string, string>> {
  return section(parseConfig((await readIfExists($, `${root}/.speckit/mod/config.yaml`)) ?? ''), 'prompt')
}

async function phasesOf($: any, root: string): Promise<string[]> {
  const cfg = parseConfig((await readIfExists($, `${root}/.speckit/mod/config.yaml`)) ?? '')
  const names: string[] = []
  for (const dir of ['.claude/skills', '.claude/commands']) {
    try { for (const x of await $.fs.list(`${root}/${dir}`)) names.push(x.name) } catch { /* directory absent */ }
  }
  return resolvePhaseModel(((section(cfg, 'phase').model ?? '').split(',').map(s => s.trim()).filter(Boolean)), names)
}

async function packOf($: any, cfg: Record<string, string>): Promise<{ dir: string; templates: { phase: string; file: string; version: string; access: string }[] } | undefined> {
  const dir = cfg.packDir || `${$.plugin.root}/../11-default-sdd-prompt-pack`
  const raw = await readIfExists($, `${dir}/pack.json`)
  if (!raw) return undefined
  try { return { dir, templates: JSON.parse(raw).templates ?? [] } } catch { return undefined }
}

async function findTemplate($: any, root: string, phase: string, cfg: Record<string, string>): Promise<Found> {
  const tries: { source: 'project-template' | 'global-template'; path: string }[] = [{ source: 'project-template', path: `${root}/.speckit/mod/prompts/${phase}.md` }]
  if (cfg.globalDir) tries.push({ source: 'global-template', path: `${cfg.globalDir}/${phase}.md` })
  for (const t of tries) {
    const text = await readIfExists($, t.path)
    if (text === undefined) continue
    const p = parseTemplate(text, phase)
    if (p.error) return { error: `malformed ${t.source} (${t.path}): ${p.error}` }
    return { source: t.source, id: `${t.source}:${phase}`, version: p.version, text: p.body, access: p.access }
  }
  const pack = await packOf($, cfg)
  const entry = pack?.templates.find(x => x.phase === phase)
  if (pack && entry) {
    const text = await readIfExists($, `${pack.dir}/${entry.file}`)
    if (text !== undefined) {
      const p = parseTemplate(text, phase)
      if (p.error) return { error: `malformed Prompt Pack template for ${phase}: ${p.error}` }
      return { source: 'pack-default', id: `pack:${phase}`, version: p.version, text: p.body, access: p.access }
    }
  }
  return { error: `no template for phase "${phase}" (no project template${pack ? ', none in the Prompt Pack' : ' and the Prompt Pack was not found'})` }
}

async function upstreamOf($: any, root: string, phase: string, args: string): Promise<{ id: string; text: string } | undefined> {
  const skillDir = `${root}/.claude/skills/speckit-${phase}`
  const skill = await readIfExists($, `${skillDir}/SKILL.md`)
  if (skill !== undefined) return { id: `speckit-${phase}`, text: `Base directory for this skill: ${skillDir}\n\n${stripFrontmatter(skill).replaceAll('$ARGUMENTS', args)}` }
  const cmd = await readIfExists($, `${root}/.claude/commands/speckit.${phase}.md`)
  if (cmd !== undefined) return { id: `speckit.${phase}`, text: stripFrontmatter(cmd).replaceAll('$ARGUMENTS', args) }
  return undefined
}

async function compute($: any, requestId: string, phase: string, argsAndOnce: string): Promise<PromptResolution> {
  const root: string = await $.session.root()
  const [args = '', oneTime = ''] = argsAndOnce.split(/\s--once\s/)
  const blocked = (reason: string): PromptResolution => ({ phase, templateId: '', version: '', hash: '', layers: [], access: 'unknown', status: 'blocked', reason, requestId })
  if (!isSafePhase(phase)) return blocked(`invalid phase name "${phase}"`)
  if (!(await phasesOf($, root)).includes(phase)) return blocked(`"${phase}" is not in the configured/discovered Spec-Kit phase set`)
  const cfg = await configOf($, root)
  const t = await findTemplate($, root, phase, cfg)
  if ('error' in t) return blocked(t.error)
  const art = (await $.state.get(ARTIFACTS)).value
  const context = `Repository root: ${root}\nSpec-Kit feature: ${art?.feature ?? 'unknown'}`
  const artifacts = art?.items?.length ? art.items.map((i: any) => `- ${i.id}: ${i.exists ? 'present' : 'missing'}, ${i.fresh}`).join('\n') : ''
  const policy = await readIfExists($, `${root}/.speckit/mod/policy.md`)
  const upstream = await upstreamOf($, root, phase, args)
  const out = compose({ phase, upstream, policy: policy ? { id: 'policy.md', text: policy } : undefined, template: t, context, artifacts, args, oneTime })
  const res: PromptResolution = {
    phase, templateId: t.id, version: t.version, hash: fingerprint(t.text), layers: out.layers,
    access: t.access === 'read-only' || t.access === 'modifies-files' ? t.access : 'unknown', status: 'resolved', composed: out.text, requestId,
  }
  return res
}

// Every outcome, blocked or resolved, is published: 03 must see a block, never infer approval from silence.
async function resolve($: any, requestId: string, phase: string, argsAndOnce: string): Promise<PromptResolution> {
  const res = await compute($, requestId, phase, argsAndOnce)
  await $.state.set(RESOLUTION, res)
  return res
}

async function confirm($: any, question: string): Promise<boolean> {
  try { return (await $.ui.ask(question, ['Yes', 'No'])) === 'Yes' } catch { return false } // rejected (e.g. -p) => fail closed
}

async function writeModFile($: any, root: string, rel: string, text: string): Promise<void> {
  const path = `${root}/.speckit/mod/${rel}`
  if (!isInsideModDir(root, path)) throw new Error(`refusing to write outside .speckit/mod/: ${rel}`)
  try { // a symlinked .speckit must not lead outside the project
    const real = (await $.fs.stat(`${root}/.speckit`, { resolve: true })).realPath
    const realRoot = (await $.fs.stat(root, { resolve: true })).realPath
    if (real && realRoot && !real.startsWith(realRoot + '/')) throw new Error('.speckit resolves outside the project')
  } catch (err: any) { if (String(err?.message).includes('outside')) throw err }
  await $.fs.write(path, text)
}

async function overview($: any): Promise<string> {
  const root: string = await $.session.root()
  const cfg = await configOf($, root)
  const rows: string[] = []
  for (const phase of await phasesOf($, root)) {
    const t = await findTemplate($, root, phase, cfg)
    rows.push('error' in t ? `${phase.padEnd(14)} BLOCKED  ${t.error}` : `${phase.padEnd(14)} ${t.source.padEnd(16)} v${t.version}  ${t.access}`)
  }
  const pack = await packOf($, cfg)
  return `Prompt templates (${pack ? 'Prompt Pack found' : 'Prompt Pack NOT found'}):\n${rows.join('\n')}`
}

async function editPhase($: any, phase: string): Promise<string> {
  const root: string = await $.session.root()
  if (!isSafePhase(phase)) return `Invalid phase "${phase}".`
  const t = await findTemplate($, root, phase, await configOf($, root))
  if ('error' in t) return `Cannot edit: ${t.error}`
  await $.prompt.fill({ text: `${editMarker(phase)}\n${t.text}`, mode: 'replace' })
  return `Template "${phase}" is in the composer for editing (the first line is a marker; keep it). Press Enter when done: the draft is captured and NOT sent. Then run /sdd-prompt save ${phase} to save it, or /sdd-prompt discard.`
}

async function savePhase($: any, phase: string): Promise<string> {
  const root: string = await $.session.root()
  const draft = drafts[phase]
  if (draft === undefined) return `No draft for "${phase}". Run /sdd-prompt edit ${phase} first.`
  const p = parseTemplate(draft, phase)
  if (p.error) return `Draft not saved: ${p.error}.`
  if (!(await confirm($, `Save this draft as the project template for "${phase}" (.speckit/mod/prompts/${phase}.md)?`))) return 'Not saved (no confirmation).'
  await writeModFile($, root, `prompts/${phase}.md`, draft)
  delete drafts[phase]
  return `Saved project template for "${phase}".`
}

async function resetPhase($: any, phase: string): Promise<string> {
  const root: string = await $.session.root()
  if (!isSafePhase(phase)) return `Invalid phase "${phase}".`
  const pack = await packOf($, await configOf($, root))
  const entry = pack?.templates.find(x => x.phase === phase)
  if (!pack || !entry) return `Restore default unavailable: the Prompt Pack has no template for "${phase}" (or was not found).`
  const text = await readIfExists($, `${pack.dir}/${entry.file}`)
  if (text === undefined) return 'Restore default unavailable: Prompt Pack file unreadable.'
  if (!(await confirm($, `Replace the project template for "${phase}" with the Prompt Pack default?`))) return 'Not reset (no confirmation).'
  await writeModFile($, root, `prompts/${phase}.md`, text)
  return `Project template for "${phase}" restored to the Prompt Pack default.`
}

async function seedPack($: any): Promise<string> {
  const root: string = await $.session.root()
  const pack = await packOf($, await configOf($, root))
  if (!pack) return 'Seed unavailable: the Prompt Pack was not found.'
  const todo: { phase: string; file: string }[] = []
  for (const t of pack.templates) if (!(await $.fs.exists(`${root}/.speckit/mod/prompts/${t.phase}.md`))) todo.push(t)
  if (!todo.length) return 'Nothing to seed: every Prompt Pack template already exists in the project (existing files are never overwritten).'
  if (!(await confirm($, `Copy ${todo.length} Prompt Pack templates into .speckit/mod/prompts/ (existing files untouched)?`))) return 'Not seeded (no confirmation).'
  for (const t of todo) { const text = await readIfExists($, `${pack.dir}/${t.file}`); if (text !== undefined) await writeModFile($, root, `prompts/${t.phase}.md`, text) }
  return `Seeded ${todo.length} templates: ${todo.map(t => t.phase).join(', ')}.`
}

async function showPhase($: any, phase: string): Promise<string> {
  const root: string = await $.session.root()
  const r = await resolve($, 'show', phase, '')
  if (r.status === 'blocked') return `BLOCKED: ${r.reason}`
  return `Phase ${phase}: ${r.templateId} v${r.version} access=${r.access}\nLayers (precedence order):\n${r.layers.map((l, i) => `  ${i + 1}. ${l.source} ${l.id}${l.version ? ' v' + l.version : ''}`).join('\n')}\n\n${preview(r.composed ?? '')}`
}

async function packCatalog($: any): Promise<string[]> {
  const root: string = await $.session.root()
  const pack = await packOf($, await configOf($, root))
  if (!pack) return ['Prompt Pack not found (Restore default and Seed are unavailable).']
  const lines: string[] = []
  for (const t of pack.templates) {
    const installed = await $.fs.exists(`${root}/.speckit/mod/prompts/${t.phase}.md`)
    lines.push(`${t.phase.padEnd(14)} v${t.version}  ${t.access.padEnd(14)} ${installed ? 'in project' : 'pack default only'}`)
  }
  return lines
}

async function publishCapability($: any): Promise<void> {
  const root: string = await $.session.root()
  const pack = await packOf($, await configOf($, root))
  await $.state.set(CAPABILITY, pack
    ? { id: 'prompt', version: '0.1.0', status: 'ready' }
    : { id: 'prompt', version: '0.1.0', status: 'degraded', reason: 'Prompt Pack not found: only project templates resolve; Seed and Restore default are unavailable' })
}

async function handle($: any, raw: string): Promise<string> {
  const [sub = '', a1 = '', ...rest] = raw.trim().split(/\s+/)
  switch (sub) {
    case '': return overview($)
    case 'show': return a1 ? showPhase($, a1) : 'Usage: /sdd-prompt show <phase>'
    case 'edit': return a1 ? editPhase($, a1) : 'Usage: /sdd-prompt edit <phase>'
    case 'save': return a1 ? savePhase($, a1) : 'Usage: /sdd-prompt save <phase>'
    case 'reset': return a1 ? resetPhase($, a1) : 'Usage: /sdd-prompt reset <phase>'
    case 'seed': return seedPack($)
    case 'discard': for (const k of Object.keys(drafts)) delete drafts[k]; return 'Edit drafts discarded.'
    case 'resolve': { // internal contract used by 03: resolve <requestId> <phase> [args] [--once text]
      const [phase = '', ...args] = rest
      const r = await resolve($, a1, phase, args.join(' '))
      return r.status === 'blocked' ? `BLOCKED ${phase}: ${r.reason}` : `resolved ${phase}: ${r.templateId} v${r.version}, ${r.layers.length} layers`
    }
    default: return 'Usage: /sdd-prompt [show|edit|save|reset|seed|discard] <phase>'
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sdd-prompt', description: 'Show, edit, save or reset SDD prompt templates', argumentHint: '[show|edit|save|reset|seed|discard] <phase>' })
    await publishCapability($)
    return next(e)
  })

  on('command.run', { command: 'sdd-prompt' }, async ($, e) => ({ text: await handle($, e.args ?? '') }))

  // Captures a template edit draft typed into the composer; the draft is never sent to the model.
  on('prompt.submit', { text: /^\s*<!--\s*sdd-edit:/ }, async ($, e, next) => {
    const d = parseEditDraft(e.text)
    if (!d || e.origin?.kind !== 'composer') return next(e)
    drafts[d.phase] = d.body
    return { drop: `Draft for "${d.phase}" captured, not sent. Run /sdd-prompt save ${d.phase} to save it or /sdd-prompt discard.` }
  })

  on('ui.render', { component: 'Pane', requestId: ['sdd', 'sdd-view'] }, async ($, e, next) => {
    const nav = (await $.state.get(NAV_VIEW)).value
    const view = nav?.activeView
    if ((view !== 'prompt' && view !== 'prompts') || (e.requestId === 'sdd' && nav?.mode === 'panes')) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    if (view === 'prompts') {
      const lines = await packCatalog($)
      return (
        <Box flexDirection="column">
          <Text bold>SDD / PROMPT PACK CATALOG (read-only)</Text>
          {lines.map(l => <Text key={l}>{l}</Text>)}
          <Button key="prompts-seed" label="Seed pack into project" hotkey="s" onPress={() => seedPack($)} />
        </Box>
      )
    }
    const current = (await $.state.get(PHASE)).value?.current
    const lines = (await overview($)).split('\n')
    return (
      <Box flexDirection="column">
        <Text bold>SDD / PROMPT</Text>
        {lines.map(l => <Text key={l}>{l}</Text>)}
        <Text dimColor>Commands: /sdd-prompt show|edit|save|reset &lt;phase&gt;</Text>
        {current ? <Button key="prompt-edit-current" label={`Edit ${current} template`} hotkey="e" onPress={() => editPhase($, current)} /> : <Text dimColor>No current phase known: use /sdd-prompt edit &lt;phase&gt;.</Text>}
      </Box>
    )
  })
}
