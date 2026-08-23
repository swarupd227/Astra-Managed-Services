import React from 'react'
import { cn } from '@/lib/format'

/* ---------------------------------- Button --------------------------------- */

type BtnVariant = 'primary' | 'default' | 'ghost' | 'danger' | 'quiet'
type BtnSize = 'sm' | 'md' | 'lg'

const BTN_BASE =
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-40'

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-brand text-ink-inv hover:brightness-[1.08] active:brightness-95 [html[data-theme=light]_&]:bg-ink [html[data-theme=light]_&]:text-ink-inv',
  default: 'border border-line-strong bg-raised text-ink hover:border-ink-3 hover:bg-sunken',
  ghost: 'text-ink-2 hover:bg-raised hover:text-ink',
  danger: 'border border-crit/50 bg-crit/10 text-crit hover:bg-crit/20',
  quiet: 'text-ink-3 hover:text-ink',
}

const BTN_SIZE: Record<BtnSize, string> = {
  sm: 'h-6 px-2 text-2xs',
  md: 'h-8 px-3 text-xs',
  lg: 'h-9 px-4 text-sm',
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }
>(function Button({ variant = 'default', size = 'md', className, ...rest }, ref) {
  return <button ref={ref} className={cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)} {...rest} />
})

/* ----------------------------------- Chip ---------------------------------- */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent'

const TONE_CHIP: Record<Tone, string> = {
  neutral: 'border-line-strong/70 text-ink-2 bg-raised',
  ok: 'border-ok/40 text-ok bg-ok/10',
  warn: 'border-warn/40 text-warn bg-warn/10',
  crit: 'border-crit/45 text-crit bg-crit/10',
  info: 'border-info/40 text-info bg-info/10',
  brand: 'border-brand/50 text-brand-ink bg-brand/10',
  agent: 'border-agent/40 text-agent bg-agent/10',
}

export function Chip({
  children, tone = 'neutral', className, mono, title, onClick,
}: {
  children: React.ReactNode
  tone?: Tone
  className?: string
  mono?: boolean
  title?: string
  onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'span'
  return (
    <Comp
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-[18px] shrink-0 items-center gap-1 rounded-xs border px-1.5 text-2xs font-medium leading-none',
        mono && 'font-mono tracking-tight',
        TONE_CHIP[tone],
        onClick && 'cursor-pointer hover:brightness-125',
        className,
      )}
    >
      {children}
    </Comp>
  )
}

/* --------------------------------- Status ---------------------------------- */

export function Dot({ tone = 'neutral', pulse }: { tone?: Tone; pulse?: boolean }) {
  const bg: Record<Tone, string> = {
    neutral: 'bg-ink-3', ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit', info: 'bg-info', brand: 'bg-brand', agent: 'bg-agent',
  }
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
      {pulse && <span className={cn('absolute inset-0 rounded-full animate-pulse-ring', bg[tone])} />}
      <span className={cn('relative h-1.5 w-1.5 rounded-full', bg[tone])} />
    </span>
  )
}

/* ---------------------------------- Card ----------------------------------- */

export function Card({
  title, subtitle, right, children, className, bodyClass, dense,
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  right?: React.ReactNode
  children?: React.ReactNode
  className?: string
  bodyClass?: string
  dense?: boolean
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-md border border-line bg-surface', className)}>
      {(title || right) && (
        <header className={cn('flex shrink-0 items-start justify-between gap-3 border-b border-line', dense ? 'px-3 py-2' : 'px-4 py-2.5')}>
          <div className="min-w-0">
            {title && <h2 className="truncate font-display text-[13px] font-semibold leading-tight text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-2xs leading-snug text-ink-3">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
        </header>
      )}
      <div className={cn('min-w-0 flex-1', dense ? 'p-3' : 'p-4', bodyClass)}>{children}</div>
    </section>
  )
}

/* ---------------------------------- Metric --------------------------------- */

export function Metric({
  label, value, unit, delta, deltaTone, hint, onClick, size = 'md',
}: {
  label: string
  value: React.ReactNode
  unit?: string
  delta?: string
  deltaTone?: Tone
  hint?: string
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-[32px]' }
  return (
    <div className={cn('min-w-0', onClick && 'group cursor-pointer')} onClick={onClick}>
      <div className="label-cap truncate">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn('tnum font-display font-semibold leading-none tracking-tight text-ink', sizes[size], onClick && 'group-hover:text-brand-ink')}>
          {value}
        </span>
        {unit && <span className="text-xs text-ink-3">{unit}</span>}
        {delta && (
          <span className={cn('tnum text-2xs font-medium', deltaTone === 'ok' ? 'text-ok' : deltaTone === 'crit' ? 'text-crit' : deltaTone === 'warn' ? 'text-warn' : 'text-ink-3')}>
            {delta}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-2xs leading-snug text-ink-3">{hint}</div>}
    </div>
  )
}

/* ----------------------------------- Bar ----------------------------------- */

export function Bar({ value, max = 100, tone = 'brand', height = 3, className }: { value: number; max?: number; tone?: Tone; height?: number; className?: string }) {
  const bg: Record<Tone, string> = {
    neutral: 'bg-ink-3', ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit', info: 'bg-info', brand: 'bg-brand', agent: 'bg-agent',
  }
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-sunken', className)} style={{ height }}>
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-snap', bg[tone])} style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }} />
    </div>
  )
}

/* ---------------------------------- Table ---------------------------------- */

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 overflow-x-auto', className)}>
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  )
}

export function Th({ children, className, align = 'left', onClick, sorted }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center'; onClick?: () => void; sorted?: 'asc' | 'desc' | null }) {
  return (
    <th
      onClick={onClick}
      className={cn(
        'sticky top-0 z-10 whitespace-nowrap border-b border-line bg-surface px-2.5 py-1.5 text-2xs font-medium uppercase tracking-[0.07em] text-ink-3',
        align === 'right' && 'text-right', align === 'center' && 'text-center',
        onClick && 'cursor-pointer select-none hover:text-ink',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sorted && <span className="text-brand-ink">{sorted === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  )
}

export function Td({ children, className, align = 'left', colSpan, title }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center'; colSpan?: number; title?: string }) {
  return (
    <td
      colSpan={colSpan}
      title={title}
      className={cn('border-b border-line/60 px-2.5 py-1.5 align-middle text-ink-2', align === 'right' && 'text-right tnum', align === 'center' && 'text-center', className)}
    >
      {children}
    </td>
  )
}

export function Tr({ children, className, onClick, selected }: { children: React.ReactNode; className?: string; onClick?: () => void; selected?: boolean }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'group transition-colors',
        onClick && 'cursor-pointer hover:bg-raised',
        selected && 'bg-brand/[0.07] hover:bg-brand/[0.1]',
        className,
      )}
    >
      {children}
    </tr>
  )
}

/* ----------------------------------- Tabs ---------------------------------- */

export function Tabs<T extends string>({
  tabs, value, onChange, className,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-0.5 overflow-x-auto', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'relative shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors',
            value === t.id ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="tnum ml-1.5 text-2xs text-ink-3">{t.count}</span>}
          {value === t.id && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand" />}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------- Field ---------------------------------- */

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label-cap">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-2xs text-ink-3">{hint}</p>}
    </label>
  )
}

export const inputClass =
  'h-8 w-full min-w-0 max-w-full rounded border border-line-strong bg-sunken px-2 text-xs text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none'

export const selectClass =
  'h-8 w-full min-w-0 max-w-full appearance-none rounded border border-line-strong bg-sunken px-2 pr-6 text-xs text-ink focus:border-brand focus:outline-none'

/* --------------------------------- Drawer ---------------------------------- */

export function Drawer({
  open, onClose, title, subtitle, children, width = 'max-w-[560px]', footer,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  children: React.ReactNode
  width?: string
  footer?: React.ReactNode
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className={cn('relative flex h-full w-full flex-col border-l border-line bg-surface shadow-pop animate-slide-in', width)}>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-2xs text-ink-3">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">Esc</Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="shrink-0 border-t border-line bg-raised px-4 py-2.5">{footer}</footer>}
      </div>
    </div>
  )
}

/* -------------------------------- Empty state ------------------------------ */

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="h-8 w-8 rounded-full border border-dashed border-line-strong" />
      <p className="text-xs font-medium text-ink-2">{title}</p>
      {body && <p className="max-w-sm text-2xs leading-relaxed text-ink-3">{body}</p>}
      {action}
    </div>
  )
}

/* --------------------------------- Tooltip --------------------------------- */

export function Hint({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <span className="group/h relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 hidden w-max max-w-[260px] -translate-x-1/2 rounded border border-line bg-raised px-2 py-1.5 text-2xs leading-relaxed text-ink-2 shadow-pop group-hover/h:block">
        {text}
      </span>
    </span>
  )
}
