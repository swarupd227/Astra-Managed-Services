/**
 * Prompt-injection classifier.
 *
 * Deterministic and cheap by design: it runs on every utterance and on the
 * context the browser assembled, before a vendor call, and it is the same
 * function the red-team harness exercises. Patterns are conservative — a
 * refusal names the pattern it matched, so a false positive is visible and
 * arguable rather than silent.
 */

const PATTERNS = [
  { id: 'override_instructions', label: 'Instruction override', re: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your|the)\b[^.\n]{0,20}\b(instructions?|rules?|guidance|system prompt|prompt)\b/i },
  { id: 'reveal_prompt', label: 'Prompt exfiltration', re: /\b(reveal|print|show|repeat|output|dump|leak)\b[^.\n]{0,30}\b(system prompt|hidden instructions?|internal (marker|instructions?)|your instructions?)\b/i },
  { id: 'persona_jailbreak', label: 'Persona jailbreak', re: /\b(you are now|from now on you are|act as|pretend (you are|to be))\b[^.\n]{0,60}\b(unrestricted|unfiltered|jailbroken|developer mode|without (rules|restrictions|limits)|DAN)\b/i },
  { id: 'dan', label: 'Do-anything-now', re: /\bdo anything now\b|\bDAN mode\b/i },
  { id: 'template_injection', label: 'Chat-template injection', re: /\[INST\]|<\|im_start\|>|<\|system\|>|<<SYS>>|<\|endoftext\|>/ },
  { id: 'role_marker', label: 'Injected role marker', re: /(^|\n)\s*(system|assistant)\s*:\s*(you|ignore|override|new instructions)/i },
  { id: 'governance_bypass', label: 'Governance bypass', re: /\b(bypass|disable|skip|turn off|circumvent)\b[^.\n]{0,40}\b(policy engine|autonomy (policy|engine|gate)|approval|the gate|four[- ]eyes|human review|evidence chain)\b/i },
  { id: 'unapproved_execution', label: 'Unattended execution demand', re: /\b(execute|run|apply|delete|purge)\b[^.\n]{0,40}\b(immediately|right now|without)\b[^.\n]{0,30}\b(approval|review|gate|asking|confirmation)\b/i },
  { id: 'secret_exfil', label: 'Secret exfiltration', re: /\b(send|post|upload|forward|email|exfiltrate|copy)\b[^.\n]{0,50}\b(api key|credentials?|secrets?|tokens?|password|private key)\b/i },
  { id: 'authority_claim', label: 'False authority claim', re: /\b(this is (a test|authori[sz]ed|approved|sanctioned)|i am (the|your) (developer|administrator|cio|owner))\b[^.\n]{0,40}\b(anthropic|the (client|customer|vendor)|your (developer|creator)s?|the platform)\b/i },
  { id: 'encoded_payload', label: 'Encoded payload', re: /(?:^|[\s:,])[A-Za-z0-9+/]{80,}={0,2}(?:$|\s)/ },
]

export function classifyInjection(text) {
  const t = String(text ?? '')
  const matches = []
  for (const p of PATTERNS) {
    const m = t.match(p.re)
    if (m) {
      const idx = Math.max(0, (m.index ?? 0) - 20)
      matches.push({ id: p.id, label: p.label, excerpt: t.slice(idx, idx + Math.min(120, m[0].length + 40)).replace(/\s+/g, ' ').trim() })
    }
  }
  return { injected: matches.length > 0, matches }
}

export const PATTERN_IDS = PATTERNS.map((p) => p.id)
