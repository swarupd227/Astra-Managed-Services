export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

const NBSP = ' '

export function num(n: number, dp = 0) {
  return n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function compact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

export function usd(n: number, dp = n < 100 ? 2 : 0) {
  return `$${n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
}

export function pct(n: number, dp = 1) {
  return `${n.toFixed(dp)}%`
}

export function signedPct(n: number, dp = 1) {
  return `${n > 0 ? '+' : ''}${n.toFixed(dp)}%`
}

/** 41 → "41m", 250 → "4h 10m", 1500 → "1d 1h" */
export function mins(m: number) {
  const v = Math.max(0, Math.round(m))
  if (v < 60) return `${v}m`
  const h = Math.floor(v / 60)
  const r = v % 60
  if (h < 24) return r ? `${h}h${NBSP}${r}m` : `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d${NBSP}${h % 24}h`
}

/** Countdown form used on SLA clocks: 02:41 or 1d 04:12 */
export function clock(m: number) {
  const neg = m < 0
  const v = Math.abs(Math.round(m))
  const d = Math.floor(v / 1440)
  const h = Math.floor((v % 1440) / 60)
  const mm = v % 60
  const core = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  return `${neg ? '−' : ''}${d ? `${d}d ` : ''}${core}`
}

export function ago(iso: string, now = new Date('2027-02-18T09:42:00.000Z')) {
  const diff = (now.getTime() - new Date(iso).getTime()) / 60000
  if (diff < 1) return 'just now'
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  const d = Math.round(diff / 1440)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

export function until(iso: string, now = new Date('2027-02-18T09:42:00.000Z')) {
  const diff = (new Date(iso).getTime() - now.getTime()) / 86400000
  if (diff < 0) return `${Math.abs(Math.round(diff))}d overdue`
  if (diff < 1) return 'due today'
  return `in ${Math.round(diff)}d`
}

export function dateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function timeShort(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function dateTime(iso: string) {
  return `${dateShort(iso)} ${timeShort(iso)}`
}

export function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function initials(name: string) {
  const parts = name.replace(/\(.*\)/, '').trim().split(/[\s.]+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function hashHex(h: string, len = 10) {
  return `${h.slice(0, len)}…`
}
