/* ==========================================================================
   Speaking to the platform, and it speaking back.

   Both sides are the browser's own — no service, no key, nothing leaves the
   machine except what the browser's own recogniser sends, which is the same
   arrangement as dictation anywhere else on the device.

   Two rules the rest of the platform already lives by, applied here.

   It listens only while a person is holding the button down. An agent that
   might be listening is worse than one that cannot: "always on" would mean
   every word said in a client meeting goes somewhere, and no indicator is
   enough to make that honest.

   What it heard goes into the composer, not into the conversation. A
   recogniser's guess is an unverified fact, and this platform does not act
   on those. The person sees the words, corrects them if they are wrong, and
   sends them.
   ========================================================================== */

interface Recogniser extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

type RecogniserCtor = new () => Recogniser

const Ctor = (): RecogniserCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecogniserCtor; webkitSpeechRecognition?: RecogniserCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** False in browsers with no recogniser — the control is then not offered at all. */
export const supportsDictation = () => Ctor() !== null

export const supportsSpeaking = () => typeof window !== 'undefined' && 'speechSynthesis' in window

let active: Recogniser | null = null

export interface DictationHandlers {
  /** Called as the recogniser revises what it heard, and once more when final. */
  onText: (text: string, final: boolean) => void
  /** Called when listening stops, however it stopped. */
  onEnd: (reason?: string) => void
}

/**
 * Starts listening. Stops when `stopDictation` is called, when the recogniser
 * decides the person has finished, or on any error — and says which, because
 * a microphone that silently stopped is indistinguishable from one that
 * heard nothing.
 */
export function startDictation({ onText, onEnd }: DictationHandlers): boolean {
  const C = Ctor()
  if (!C) return false
  stopDictation()

  const r = new C()
  r.lang = 'en-GB'
  r.continuous = true
  // Interim results are shown so the person can see it is working. A button
  // that lights up and produces nothing for four seconds reads as broken.
  r.interimResults = true

  r.onresult = (e) => {
    let interim = ''
    let final = ''
    for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i]
      const text = res[0]?.transcript ?? ''
      if (res.isFinal) final += text
      else interim += text
    }
    if (final) onText(final.trim(), true)
    else if (interim) onText(interim.trim(), false)
  }
  r.onerror = (e) => {
    active = null
    onEnd(e.error === 'not-allowed' ? 'The browser refused access to the microphone.'
      : e.error === 'no-speech' ? 'Nothing was heard.'
        : `The recogniser stopped: ${e.error}.`)
  }
  r.onend = () => {
    if (active === r) active = null
    onEnd()
  }

  active = r
  try {
    r.start()
    return true
  } catch {
    active = null
    return false
  }
}

export function stopDictation() {
  if (!active) return
  const r = active
  active = null
  try { r.stop() } catch { /* already stopped */ }
}

/* --------------------------------- Speaking -------------------------------- */

/**
 * Reads a reply aloud.
 *
 * Only the agent's own sentences: the cards beside them are figures and
 * tables, and a table read aloud is noise. Anything already being spoken is
 * cut off rather than queued, because a reply about a figure that has since
 * changed should not still be being read when the next answer arrives.
 */
export function speak(text: string) {
  if (!supportsSpeaking() || !text.trim()) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').trim())
  u.lang = 'en-GB'
  u.rate = 1.05
  window.speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (supportsSpeaking()) window.speechSynthesis.cancel()
}
