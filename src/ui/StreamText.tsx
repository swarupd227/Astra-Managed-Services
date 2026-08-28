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
  const nRef = React.useRef(n)
  const prevTextRef = React.useRef('')
  nRef.current = n

  React.useEffect(() => {
    if (instant) { setN(text.length); prevTextRef.current = text; return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(text.length)
      prevTextRef.current = text
      onDone?.()
      return
    }
    // Mid-stream, `text` is the whole accumulated string growing token by
    // token, so its identity changes on every chunk. Resetting the reveal to
    // 0 here would collapse and re-grow the visible text on every token —
    // only a genuinely new string (not a continuation of the one already
    // revealing) restarts the reveal from scratch.
    if (!text.startsWith(prevTextRef.current)) {
      setN(0)
      nRef.current = 0
    }
    prevTextRef.current = text
    doneRef.current = false
    const id = window.setInterval(() => {
      const next = nRef.current + 4
      if (next >= text.length) {
        setN(text.length)
        nRef.current = text.length
        window.clearInterval(id)
        if (!doneRef.current) { doneRef.current = true; onDone?.() }
      } else {
        setN(next)
        nRef.current = next
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
