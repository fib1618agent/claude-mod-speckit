import type { ArtifactFreshness, ArtifactItem } from '../../types'

// The artifact model: which phase produces each artifact and what it depends on (the single staleness model).
export type ArtifactModel = { id: string; producedBy: string; dependsOn: string[] }

export const ARTIFACT_MODEL: ArtifactModel[] = [
  { id: 'constitution', producedBy: 'constitution', dependsOn: [] },
  { id: 'spec', producedBy: 'specify', dependsOn: [] },
  { id: 'plan', producedBy: 'plan', dependsOn: ['spec'] },
  { id: 'checklist', producedBy: 'checklist', dependsOn: ['spec', 'plan'] },
  { id: 'tasks', producedBy: 'tasks', dependsOn: ['plan'] },
]

export const IMPLEMENTATION_MODEL: ArtifactModel = { id: 'implementation', producedBy: 'implement', dependsOn: ['tasks'] }

export type Fact = { path: string; status: 'present' | 'missing' | 'unreadable'; mtime: number; size: number; hash: string }

// Spec-Kit records the active feature in .specify/feature.json as {"feature_directory": "specs/<name>"}.
export function featureFromJson(text: string | undefined): string | undefined {
  if (!text) return undefined
  try {
    const dir = JSON.parse(text)?.feature_directory
    if (typeof dir !== 'string') return undefined
    return dir.replace(/\/+$/, '').replace(/^(\.\/)?specs\//, '') || undefined
  } catch { return undefined }
}

// Precedence: config override, then .specify/feature.json (only if that directory exists), then newest by mtime.
export function pickFeature(dirs: { name: string; mtimeMs: number }[], override?: string, active?: string): string | null {
  if (override) return override
  if (active && dirs.some(d => d.name === active)) return active
  if (!dirs.length) return null
  const newest = [...dirs].sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name))[0]
  return newest ? newest.name : null
}

// fresh = every dependency exists and was last modified no later than this artifact. Anything unreadable/missing is unknown.
export function freshness(item: Fact | undefined, deps: (Fact | undefined)[]): ArtifactFreshness {
  if (!item || item.status !== 'present') return 'unknown'
  if (!deps.length) return 'fresh'
  if (deps.some(d => !d || d.status !== 'present')) return 'unknown'
  return deps.every(d => d!.mtime <= item.mtime) ? 'fresh' : 'stale'
}

export function buildItems(models: ArtifactModel[], facts: Record<string, Fact | undefined>, previous: Record<string, string>): ArtifactItem[] {
  return models.map(m => {
    const f = facts[m.id]
    const present = f?.status === 'present'
    return {
      id: m.id,
      exists: present,
      hash: present ? f!.hash : '',
      mtime: present ? f!.mtime : 0,
      producedBy: m.producedBy,
      dependsOn: m.dependsOn,
      fresh: freshness(f, m.dependsOn.map(d => facts[d])),
      path: f?.path,
      size: present ? f!.size : undefined,
      status: f?.status ?? 'missing',
      changed: present && previous[m.id] !== undefined && previous[m.id] !== f!.hash,
    }
  })
}

// Text matrix: used by /sdd-artifacts and as the Navigator-independent fallback.
export function formatMatrix(items: ArtifactItem[]): string {
  if (!items.length) return 'No Spec-Kit artifacts found.'
  const rows = items.map(i => [i.id, i.exists ? 'yes' : 'no', i.fresh, i.producedBy, i.dependsOn.join(',') || '-', i.status ?? '-'])
  const head = ['Artifact', 'Exists', 'Fresh', 'Source Phase', 'Depends On', 'Status']
  const all = [head, ...rows]
  const w = head.map((_, c) => Math.max(...all.map(r => (r[c] ?? '').length)))
  return all.map(r => r.map((x, c) => x.padEnd(w[c] ?? 0)).join(' | ')).join('\n')
}

export function staleIds(items: ArtifactItem[]): string[] {
  return items.filter(i => i.fresh === 'stale').map(i => i.id)
}
