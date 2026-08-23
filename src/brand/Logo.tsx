import { cn } from '@/lib/format'

/**
 * Artizent mark — the angular A with its leading stroke, redrawn as vector so it
 * stays crisp at any size and can take a theme-appropriate colour. The raster
 * lockup from artizent.com ships in /public/brand for dark-surface use.
 */
export function ArtizentMark({
  className, size = 20, color = 'currentColor',
}: { className?: string; size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 118 80" width={(size * 118) / 80} height={size} className={cn('shrink-0', className)} role="img" aria-label="Artizent">
      <g fill={color}>
        <path d="M30.5 0h17.2L21.2 80H4z" />
        <path d="M52.8 0 25.2 80h17.3l7.6-22.6h29.1L86.8 80H104L76.4 0zM55.4 43.8 64.6 16l9.2 27.8z" />
      </g>
    </svg>
  )
}

/**
 * Full lockup. The mark keeps brand yellow on dark surfaces; on light surfaces
 * yellow-on-white fails contrast, so the mark takes ink and the wordmark stays
 * ink throughout.
 */
export function ArtizentLockup({ className, height = 18 }: { className?: string; height?: number }) {
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)} aria-label="Artizent">
      <ArtizentMark size={height} className="translate-y-[2px] text-brand-ink [html[data-theme=light]_&]:text-ink" />
      <span
        className="font-display font-semibold lowercase tracking-[-0.01em] text-ink"
        style={{ fontSize: height * 0.95, lineHeight: 1 }}
      >
        artizent
      </span>
    </span>
  )
}

/** Product signature in the shell's top-left. */
export function AstraSignature({ compactMode }: { compactMode?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <ArtizentMark size={19} className="text-brand-ink [html[data-theme=light]_&]:text-ink" />
      {!compactMode && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="font-display text-[13px] font-semibold tracking-tight text-ink">Astra</span>
          <span className="mt-[3px] text-[9px] font-medium uppercase tracking-[0.14em] text-ink-3">Managed Services</span>
        </span>
      )}
    </span>
  )
}
