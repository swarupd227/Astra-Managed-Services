import React from 'react'
import { cn } from '@/lib/format'

/**
 * Reveals text as it is produced. Agent reasoning arrives progressively in the
 * runtime, and the console shows it that way — a finished paragraph appearing
 * at once reads as a canned script rather than as work being done.
 */
export function StreamText({
  text, speed = 7, className, onDone, instant,
}: {
  text: string
  speed?: number
  className?: string
  onDone?: () => void
  instant?: boolean
}) {
  const [n, setN] = React.useState(instant ? text.length : 0)
  const doneRef = React.useRef(false)

  React.useEffect(() => {
    if (instant) { setN(text.length); return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(text.length)
      onDone?.()
      return
    }
    setN(0)
    doneRef.current = false
    let i = 0
    const id = window.setInterval(() => {
      i += 4
      if (i >= text.length) {
        setN(text.length)
        window.clearInterval(id)
        if (!doneRef.current) { doneRef.current = true; onDone?.() }
      } else {
        setN(i)
      }
    }, speed)
    return () => window.clearInterval(id)
    // onDone intentionally excluded: identity changes must not restart the reveal
  }, [text, speed, instant])

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {text.slice(0, n)}
      {n < text.length && <span className="ml-px inline-block w-[2px] animate-caret bg-brand-ink align-[-0.1em]" style={{ height: '0.95em' }} />}
    </span>
  )
}
