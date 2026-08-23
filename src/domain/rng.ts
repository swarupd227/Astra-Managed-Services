/**
 * Deterministic PRNG. The demonstration estate must be byte-identical on every
 * load — a briefing where the numbers move between refreshes is not credible.
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private r: () => number
  constructor(seed: number) {
    this.r = mulberry32(seed)
  }
  next() {
    return this.r()
  }
  int(min: number, max: number) {
    return Math.floor(this.r() * (max - min + 1)) + min
  }
  float(min: number, max: number, dp = 2) {
    const v = this.r() * (max - min) + min
    const f = Math.pow(10, dp)
    return Math.round(v * f) / f
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.r() * arr.length)]
  }
  pickWeighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, e) => s + e[1], 0)
    let x = this.r() * total
    for (const [v, w] of entries) {
      x -= w
      if (x <= 0) return v
    }
    return entries[entries.length - 1][0]
  }
  bool(p = 0.5) {
    return this.r() < p
  }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
}

/**
 * FNV-1a — a fast, stable 32-bit content hash. Used for the evidence chain's
 * digest display. Real deployments anchor SHA-256 roots externally (§20.3);
 * this keeps the chain arithmetic visible and verifiable in the browser.
 */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** Longer digest built from four salted FNV passes — display-realistic, still deterministic. */
export function digest(input: string): string {
  return [0, 1, 2, 3].map((s) => fnv1a(`${s}:${input}`)).join('')
}
