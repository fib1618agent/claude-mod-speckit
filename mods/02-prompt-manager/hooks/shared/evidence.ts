// Evidence freshness: hashes recorded when evidence was produced vs the CURRENT hashes published by 05's inventory.
// 05 owns the artifact hashes; consumers only compare. Missing inventory or empty evidence is `unknown`, never `fresh`.
export function evidenceFreshness(evidence: Record<string, string> | undefined, current: Record<string, string> | undefined): 'fresh' | 'stale' | 'unknown' {
  if (!evidence || !current) return 'unknown'
  const ids = Object.keys(evidence)
  if (!ids.length) return 'unknown'
  return ids.every(id => current[id] === evidence[id]) ? 'fresh' : 'stale'
}
