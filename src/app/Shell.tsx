import React from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertOctagon, Bot, Check, ChevronDown, ChevronRight, Command, Info, Moon, Pause, Play, Rows3,
  Plug, Search, ShieldAlert, Sparkles, Sun, TriangleAlert, X,
} from 'lucide-react'
import { AstraSignature, ArtizentLockup } from '@/brand/Logo'
import { PINNED, SURFACES } from './nav'
import { CommandPalette } from './CommandPalette'
import { ROLES, ROLE_BY_ID } from '@/domain/reference'
import { CLIENT, TOWER_BY_ID } from '@/domain/estate'
import { AI_FUNCTIONS, type Suspension } from '@/domain/suspensions'
import { OBLIGATIONS } from '@/domain/ledgers'
import { useAstra, useApprovalCount } from '@/domain/store'
import { Avatar } from '@/ui/domain'
import { Button, Chip, Dot } from '@/ui/primitives'
import { cn } from '@/lib/format'
import type { SurfaceId } from '@/domain/types'

/* -------------------------------- Top banners ------------------------------ */

function MiBanner() {
  const mi = useAstra((s) => s.mi)
  const closeMi = useAstra((s) => s.closeMi)
  const roleId = useAstra((s) => s.roleId)
  const nav = useNavigate()
  if (!mi.active) return null
  const role = ROLE_BY_ID[roleId]
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-crit/40 bg-crit/12 px-4 py-1.5">
      <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-crit">
        <AlertOctagon size={13} strokeWidth={2.4} />
        Major incident
      </span>
      <span className="min-w-0 flex-1 truncate text-2xs text-ink-2">
        {mi.title} · declared by {mi.declaredBy} · <span className="text-crit">autonomy capped at L1 Advise platform-wide</span>
      </span>
      <Button size="sm" variant="ghost" onClick={() => nav('/operate/mim')}>Incident room</Button>
      {role.canApprove && <Button size="sm" variant="default" onClick={() => closeMi(role.person)}>Close MI</Button>}
    </div>
  )
}

function suspensionLabel(x: Suspension) {
  switch (x.scope) {
    case 'global': return 'platform-wide'
    case 'tower': return TOWER_BY_ID[x.target]?.name ?? x.target
    case 'actionClass': return `${x.target}${x.tower ? ` · ${TOWER_BY_ID[x.tower]?.name ?? x.tower}` : ' · all towers'}`
    case 'function': return AI_FUNCTIONS.find((f) => f.id === x.target)?.label ?? x.target
    default: return x.target
  }
}

/** Every suspension in force, each releasable on its own — not one banner for one switch. */
function BrakeBanner() {
  const suspensions = useAstra((s) => s.suspensions)
  const agents = useAstra((s) => s.agents)
  const release = useAstra((s) => s.release)
  const roleId = useAstra((s) => s.roleId)
  const suspendedAgents = Object.values(agents).filter((a) => a.state === 'suspended').length
  if (suspensions.length === 0 && suspendedAgents === 0) return null
  const role = ROLE_BY_ID[roleId]
  const global = suspensions.some((x) => x.scope === 'global')
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-warn/40 bg-warn/10 px-4 py-1.5">
      <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-warn">
        <ShieldAlert size={13} strokeWidth={2.4} />
        Autonomy brake
      </span>
      <span className="text-2xs text-ink-2">
        {global
          ? 'Platform-wide brake applied. Every agent is at L1 Advise; work continues through humans via the mirrored ITSM.'
          : `${suspensions.length} suspension${suspensions.length === 1 ? '' : 's'} in force${suspendedAgents ? ` · ${suspendedAgents} agent${suspendedAgents === 1 ? '' : 's'} suspended` : ''}.`}
      </span>
      {suspensions.map((x) => (
        <span
          key={x.id}
          className="flex items-center gap-1 rounded border border-warn/40 bg-surface px-1.5 py-0.5 text-2xs text-ink-2"
          title={`${x.reason} — ${x.by}${x.directedByCustomer ? ' (customer-directed)' : ''}`}
        >
          <span className="font-mono text-ink-3">{x.scope}</span>
          {suspensionLabel(x)}
          {x.directedByCustomer && <span className="text-ink-3">· customer-directed</span>}
          {role.canApprove && (
            <button onClick={() => release(x.id, role.person)} className="ml-1 text-ink-3 hover:text-ink" title="Release">
              <X size={10} />
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

/* --------------------------------- Toasts ---------------------------------- */

function Toasts() {
  const toasts = useAstra((s) => s.toasts)
  const dismiss = useAstra((s) => s.dismissToast)
  const nav = useNavigate()
  const icon = { ok: Check, warn: TriangleAlert, crit: AlertOctagon, info: Info }
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[330px] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icon[t.tone]
        const tone = { ok: 'border-ok/40 text-ok', warn: 'border-warn/40 text-warn', crit: 'border-crit/45 text-crit', info: 'border-info/40 text-info' }[t.tone]
        return (
          <div key={t.id} className={cn('pointer-events-auto flex animate-fade-up gap-2.5 rounded-md border bg-surface p-2.5 shadow-pop', tone)}>
            <Icon size={14} strokeWidth={2.2} className="mt-px shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-2xs leading-relaxed text-ink-3">{t.body}</p>}
              {t.evidenceId && (
                <button
                  onClick={() => { nav(`/governance/evidence?q=${t.evidenceId}`); dismiss(t.id) }}
                  className="mt-1 font-mono text-2xs text-ink-3 underline decoration-dotted underline-offset-2 hover:text-brand-ink"
                >
                  {t.evidenceId}
                </button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="shrink-0 self-start text-ink-3 hover:text-ink" aria-label="Dismiss">
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------ Role switcher ------------------------------ */

function RoleSwitcher() {
  const roleId = useAstra((s) => s.roleId)
  const setRole = useAstra((s) => s.setRole)
  const nav = useNavigate()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const role = ROLE_BY_ID[roleId]

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-2 rounded border border-line-strong bg-raised pl-1.5 pr-2 text-left transition-colors hover:border-ink-3"
      >
        <Avatar name={role.person} size={20} />
        <span className="hidden min-w-0 flex-col leading-none sm:flex">
          <span className="truncate text-2xs font-medium text-ink">{role.person}</span>
          <span className="mt-[2px] truncate text-[9px] text-ink-3">{role.title}</span>
        </span>
        <ChevronDown size={12} className="shrink-0 text-ink-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-[330px] overflow-hidden rounded-md border border-line-strong bg-surface shadow-pop">
          <div className="border-b border-line px-3 py-2">
            <p className="text-2xs font-medium text-ink">Assume a role</p>
            <p className="mt-0.5 text-2xs leading-relaxed text-ink-3">
              Navigation, home screen and approval rights follow the role.
            </p>
          </div>
          <div className="max-h-[52vh] overflow-y-auto py-1">
            {(['artizent', 'client'] as const).map((org) => (
              <div key={org}>
                <div className="px-3 py-1 text-2xs font-medium uppercase tracking-[0.09em] text-ink-3">
                  {org === 'artizent' ? 'Artizent' : CLIENT.short}
                </div>
                {ROLES.filter((r) => r.org === org).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setRole(r.id); nav(r.home); setOpen(false) }}
                    className={cn('flex w-full items-start gap-2.5 px-3 py-1.5 text-left hover:bg-raised', r.id === roleId && 'bg-brand/10')}
                  >
                    <Avatar name={r.person} size={20} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs text-ink">{r.title}</span>
                        {r.readOnly && <Chip tone="neutral">read-only</Chip>}
                        {r.id === roleId && <Check size={11} className="shrink-0 text-brand-ink" />}
                      </span>
                      <span className="mt-0.5 block text-2xs leading-snug text-ink-3">{r.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* --------------------------------- Sidebar --------------------------------- */

function NavRow({
  item, active, collapsed, badge, icon, strong,
}: {
  item: { to: string; label: string; desc: string }
  active: boolean
  collapsed: boolean
  badge?: { n: number; tone: 'warn' | 'brand' | 'crit' } | null
  icon?: React.ReactNode
  strong?: boolean
}) {
  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : item.desc}
      className={cn(
        'group relative flex items-center gap-2 rounded-[4px] py-[5px] pr-2 transition-colors',
        collapsed ? 'mx-1.5 justify-center px-0' : 'mx-1.5 pl-2',
        strong ? 'text-xs font-medium' : 'text-xs',
        active ? 'bg-brand/[0.16] text-ink' : 'text-ink-2 hover:bg-raised hover:text-ink',
      )}
    >
      {active && <span className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-brand" />}
      {icon ?? <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', active ? 'bg-brand' : 'bg-line-strong')} />}
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {badge && (
            <span
              className={cn(
                'tnum shrink-0 rounded-full px-1.5 text-[10px] font-semibold leading-[15px]',
                badge.tone === 'warn' && 'bg-warn/20 text-warn',
                badge.tone === 'brand' && 'bg-brand/25 text-brand-ink',
                badge.tone === 'crit' && 'bg-crit/20 text-crit',
              )}
            >
              {badge.n}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const roleId = useAstra((s) => s.roleId)
  const approvalCount = useApprovalCount()
  const assertions = useAstra((s) => s.assertions)
  const mi = useAstra((s) => s.mi)
  const role = ROLE_BY_ID[roleId]
  const { pathname } = useLocation()

  const pendingVerify = assertions.filter((a) => a.verification !== 'human_verified' && a.verification !== 'stale').length
  const overdueObl = OBLIGATIONS.filter((o) => o.state === 'red').length

  const badgeFor = (kind?: string) => {
    if (kind === 'approvals' && approvalCount) return { n: approvalCount, tone: 'warn' as const }
    if (kind === 'verify' && pendingVerify) return { n: pendingVerify, tone: 'brand' as const }
    if (kind === 'mi' && mi.active) return { n: 1, tone: 'crit' as const }
    if (kind === 'obligations' && overdueObl) return { n: overdueObl, tone: 'crit' as const }
    return null
  }

  // Only the section you are working in stays open; the rest collapse to a
  // header with its outstanding count, so the rail shows about eight rows
  // rather than twenty-five.
  const activeSurface = SURFACES.find((s) => s.items.some((i) => pathname.startsWith(i.to)))?.id
  const [open, setOpen] = React.useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('astra.nav') ?? '{}')
    } catch {
      return {}
    }
  })

  React.useEffect(() => {
    if (activeSurface) setOpen((o) => ({ ...o, [activeSurface]: true }))
  }, [activeSurface])

  const toggle = (id: string) => {
    setOpen((o) => {
      const next = { ...o, [id]: !isOpen(id) }
      localStorage.setItem('astra.nav', JSON.stringify(next))
      return next
    })
  }
  const isOpen = (id: string) => open[id] ?? id === activeSurface

  return (
    <nav className={cn('flex min-w-0 shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-line bg-surface transition-[width] duration-200 ease-snap', collapsed ? 'w-[52px]' : 'w-[216px]')}>
      <div className="border-b border-line py-1.5">
        <ul className="space-y-px">
          {PINNED.map((item) => (
            <li key={item.to}>
              <NavRow
                item={item}
                active={pathname.startsWith(item.to)}
                collapsed={collapsed}
                strong
                icon={
                  item.to === '/copilot'
                    ? <Sparkles size={13} className={cn('shrink-0', pathname.startsWith(item.to) ? 'text-brand-ink' : 'text-ink-3')} />
                    : <Bot size={13} className={cn('shrink-0', pathname.startsWith(item.to) ? 'text-brand-ink' : 'text-ink-3')} />
                }
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="py-1.5">
        {SURFACES.map((s) => {
          const permitted = role.surfaces.includes(s.id as SurfaceId)
          const expanded = isOpen(s.id)
          const outstanding = s.items.reduce((n, i) => n + (badgeFor(i.badge)?.n ?? 0), 0)

          if (collapsed) {
            return (
              <ul key={s.id} className={cn('space-y-px border-b border-line py-1.5 last:border-b-0', !permitted && 'opacity-30')}>
                {s.items.map((item) => (
                  <li key={item.to}>
                    <NavRow item={item} active={pathname.startsWith(item.to)} collapsed badge={badgeFor(item.badge)} />
                  </li>
                ))}
              </ul>
            )
          }

          return (
            <div key={s.id} className={cn('mb-0.5', !permitted && 'opacity-40')}>
              <button
                onClick={() => toggle(s.id)}
                aria-expanded={expanded}
                className="mx-1.5 flex w-[calc(100%-12px)] items-center gap-1.5 rounded-[4px] px-2 py-1.5 text-left transition-colors hover:bg-raised"
              >
                <ChevronRight size={11} className={cn('shrink-0 text-ink-3 transition-transform duration-150', expanded && 'rotate-90')} />
                <span className="min-w-0 flex-1 truncate text-2xs font-semibold uppercase tracking-[0.07em] text-ink-2">{s.short}</span>
                {!permitted && <span className="shrink-0 text-[10px] text-ink-3">restricted</span>}
                {!expanded && outstanding > 0 && (
                  <span className="tnum shrink-0 rounded-full bg-warn/20 px-1.5 text-[10px] font-semibold leading-[15px] text-warn">{outstanding}</span>
                )}
              </button>
              {expanded && (
                <ul className="space-y-px pb-1">
                  {s.items.map((item) => (
                    <li key={item.to}>
                      <NavRow item={item} active={pathname.startsWith(item.to)} collapsed={false} badge={badgeFor(item.badge)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {!collapsed && (
        <div className="mt-auto shrink-0 border-t border-line px-3 py-2.5">
          <ArtizentLockup height={12} />
          <p className="mt-1 truncate text-[10px] text-ink-3" title={`${CLIENT.name} · ${CLIENT.contract}`}>
            {CLIENT.name}
          </p>
        </div>
      )}
    </nav>
  )
}

/* ---------------------------------- Shell ---------------------------------- */

export function Shell() {
  const nav = useNavigate()
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)
  const [gatewayReady, setGatewayReady] = React.useState<boolean | null>(null)

  // Poll the gateway so an unavailable agent runtime is visible immediately,
  // rather than being discovered on a failed run.
  React.useEffect(() => {
    const check = () =>
      fetch('/api/agent/health')
        .then((r) => r.json())
        .then((j) => setGatewayReady(Boolean(j.configured)))
        .catch(() => setGatewayReady(false))
    void check()
    const t = setInterval(check, 20000)
    return () => clearInterval(t)
  }, [])
  const theme = useAstra((s) => s.theme)
  const setTheme = useAstra((s) => s.setTheme)
  const density = useAstra((s) => s.density)
  const setDensity = useAstra((s) => s.setDensity)
  const simRunning = useAstra((s) => s.simRunning)
  const toggleSim = useAstra((s) => s.toggleSim)
  const advance = useAstra((s) => s.advance)
  const clockOffset = useAstra((s) => s.clockOffsetMins)
  const roleId = useAstra((s) => s.roleId)
  const setBrake = useAstra((s) => s.setBrake)
  const brake = useAstra((s) => s.brake)
  const role = ROLE_BY_ID[roleId]

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-density', density)
  }, [theme, density])

  // Below the lg breakpoint the navigation rail collapses to its icon width so
  // the console keeps a usable working area in a narrow pane. Driven off resize
  // rather than a media-query listener alone, which does not fire under a
  // programmatic viewport override.
  React.useEffect(() => {
    const apply = () => setCollapsed(window.innerWidth < 1024)
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  React.useEffect(() => {
    if (!simRunning) return
    const t = setInterval(advance, 2200)
    return () => clearInterval(t)
  }, [simRunning, advance])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true) }
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) { e.preventDefault(); setPaletteOpen(true) }
      if ((e.metaKey || e.ctrlKey) && e.key === '.') { e.preventDefault(); setCollapsed((c) => !c) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const estateTime = new Date(new Date('2027-02-18T09:42:00.000Z').getTime() + clockOffset * 60000)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-canvas">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
        <button onClick={() => setCollapsed((c) => !c)} className="flex items-center rounded px-1 py-1 hover:bg-raised" title="Toggle navigation (⌘.)">
          <AstraSignature compactMode={collapsed} />
        </button>

        <span className="hidden items-center gap-1.5 border-l border-line pl-3 md:flex">
          <Dot tone="ok" pulse={simRunning} />
          <span className="text-2xs text-ink-2">{CLIENT.name}</span>
          <span className="text-2xs text-ink-3">· month {CLIENT.monthsElapsed}</span>
        </span>

        <button
          onClick={() => setPaletteOpen(true)}
          className="ml-auto flex h-7 max-w-[280px] flex-1 items-center gap-2 rounded border border-line-strong bg-sunken px-2 text-ink-3 transition-colors hover:border-ink-3"
        >
          <Search size={12} className="shrink-0" />
          <span className="hidden truncate text-2xs sm:block">Search or jump to…</span>
          <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-line px-1 font-mono text-[10px] sm:flex">
            <Command size={8} />K
          </kbd>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <span className="tnum hidden items-center gap-1.5 rounded border border-line px-1.5 py-1 text-2xs text-ink-3 lg:flex" title="Estate clock (Europe/Berlin). The simulation advances one minute per tick.">
            {estateTime.toISOString().slice(0, 10)} {estateTime.toISOString().slice(11, 16)}
          </span>
          <Button size="sm" variant="ghost" onClick={toggleSim} title={simRunning ? 'Pause the live estate' : 'Resume the live estate'}>
            {simRunning ? <Pause size={12} /> : <Play size={12} />}
          </Button>
          <Button
            size="sm"
            variant={brake.global ? 'danger' : 'ghost'}
            onClick={() => setBrake('global', !brake.global, role.person)}
            title="Global autonomy brake — one action, evidenced, tested in game-days"
            disabled={!role.canApprove}
          >
            <ShieldAlert size={12} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')} title="Row density">
            <Rows3 size={12} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Theme">
            {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
          </Button>
          <Button
            size="sm"
            variant={gatewayReady === false ? 'danger' : 'ghost'}
            onClick={() => nav('/settings/connection')}
            title={gatewayReady === false ? 'Agent runtime not connected — open Connection settings' : 'Connection settings'}
          >
            <Plug size={12} />
          </Button>
        </div>

        <RoleSwitcher />
      </header>

      <MiBanner />
      <BrakeBanner />

      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toasts />
    </div>
  )
}
