import type { PromptAccess, PromptLayer, PromptLayerSource } from '../../types'
import { fingerprint } from '../shared/fingerprint'

export const MAX_COMPOSED = 60_000

export type ParsedTemplate = { version: string; access: PromptAccess; body: string; error?: string }

// `<!-- sdd-pack: phase=plan version=1 access=read-only -->` is optional on project templates.
export function parseTemplate(text: string, phase: string): ParsedTemplate {
  const m = /^\s*<!--\s*sdd-pack:\s*([^>]*?)\s*-->\s*\n?/.exec(text)
  let version = 'project'
  let access: PromptAccess = 'unknown'
  let body = text
  if (m) {
    body = text.slice(m[0].length)
    const kv: Record<string, string> = {}
    for (const part of (m[1] ?? '').split(/\s+/)) {
      const [k, v] = part.split('=')
      if (k && v) kv[k] = v
    }
    if (kv.phase && kv.phase !== phase) return { version, access, body, error: `template header is for phase "${kv.phase}", not "${phase}"` }
    version = kv.version ?? version
    if (kv.access === 'read-only' || kv.access === 'modifies-files') access = kv.access
  }
  if (!body.trim()) return { version, access, body, error: 'template is empty' }
  return { version, access, body }
}

export function stripFrontmatter(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, '')
}

// Only [a-z0-9-] phase names may become file names; no path separators or dots.
export function isSafePhase(phase: string): boolean {
  return /^[a-z][a-z0-9-]{0,40}$/.test(phase)
}

// Writes are limited to the project's .speckit/mod/ tree.
export function isInsideModDir(root: string, path: string): boolean {
  if (path.includes('..') || path.includes('\0')) return false
  return path.startsWith(`${root}/.speckit/mod/`)
}

export const editMarker = (phase: string) => `<!-- sdd-edit:${phase} -->`

export function parseEditDraft(text: string): { phase: string; body: string } | null {
  const m = /^\s*<!--\s*sdd-edit:([a-z][a-z0-9-]*)\s*-->\s*\n?/.exec(text)
  return m && m[1] ? { phase: m[1], body: text.slice(m[0].length) } : null
}

export type ComposeInput = {
  phase: string
  upstream?: { id: string; text: string }
  policy?: { id: string; text: string }
  template: { source: Extract<PromptLayerSource, 'project-template' | 'global-template' | 'pack-default'>; id: string; version: string; text: string }
  context: string
  artifacts: string
  args: string
  oneTime: string
}

// Precedence is visible: layers are numbered and labeled; nothing silently replaces a higher layer.
export function compose(input: ComposeInput): { text: string; layers: PromptLayer[] } {
  const layers: PromptLayer[] = []
  const parts: string[] = [`# Reviewed SDD execution — phase: ${input.phase}`]
  const add = (n: number, title: string, source: PromptLayerSource, id: string, text: string | undefined, version?: string) => {
    if (!text || !text.trim()) return
    layers.push({ source, id, hash: fingerprint(text), ...(version ? { version } : {}) })
    parts.push(`\n## Layer ${n} — ${title}\n${text.trim()}`)
  }
  add(1, `Upstream Spec-Kit instructions (verbatim from the installed ${input.upstream?.id ?? 'skill'}; official text)`, 'upstream', input.upstream?.id ?? '', input.upstream?.text)
  add(2, `Organization / project engineering policy (${input.policy?.id ?? ''})`, 'policy', input.policy?.id ?? '', input.policy?.text)
  add(3, `SDD prompt template — ${input.template.source} ${input.template.id} v${input.template.version} (NOT official Spec-Kit text)`, input.template.source, input.template.id, input.template.text, input.template.version)
  add(4, 'Repository context', 'context', 'context', input.context)
  add(5, 'Current feature artifacts', 'artifacts', 'artifacts', input.artifacts)
  add(6, 'User arguments', 'arguments', 'arguments', input.args)
  add(7, 'One-time instructions', 'one-time', 'one-time', input.oneTime)
  let text = parts.join('\n')
  if (text.length > MAX_COMPOSED) text = text.slice(0, MAX_COMPOSED) + '\n\n[truncated: composed prompt exceeded the size limit]'
  return { text, layers }
}

export function preview(text: string, max = 1500): string {
  return text.length <= max ? text : text.slice(0, max) + `\n… [${text.length - max} more characters]`
}
