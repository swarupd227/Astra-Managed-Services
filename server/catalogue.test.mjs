import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/* ==========================================================================
   Whether the catalogue says what the platform will actually do.

   The catalogue is the single source for tools and role rights, which makes
   every claim in it load-bearing twice over: the orchestrator chooses what to
   call from the descriptions, and the user approves a state change from the
   confirmation sentence. Both are prose in a JSON file, so nothing but a test
   stops a placeholder naming an input that does not exist.

   That is not hypothetical. `set_procedure_areas` — mutating, and gated on an
   approval — carried "Adopt {count} procedure areas", and `count` was never
   one of its inputs. The Confirm card therefore asked the user to adopt an em
   dash of procedure areas, and had done since the tool was written.
   ========================================================================== */

const CATALOGUE = JSON.parse(readFileSync(new URL('./tool-catalogue.json', import.meta.url), 'utf8'))
const TOOLS = CATALOGUE.tools

/** The browser's substitution, mirrored: src/workspace/catalogue.ts. */
const PLACEHOLDER = /\{(\w+)\}/g

test('every confirmation sentence substitutes something the call actually carries', () => {
  const broken = []
  for (const tool of TOOLS) {
    if (!tool.describe) continue
    const declared = Object.keys(tool.input_schema?.properties ?? {})
    for (const [, name] of tool.describe.matchAll(PLACEHOLDER)) {
      if (!declared.includes(name)) broken.push(`${tool.name}: {${name}} is not an input (has ${declared.join(', ') || 'none'})`)
    }
  }
  assert.deepEqual(broken, [], `A placeholder renders as a dash on the card the user approves:\n  ${broken.join('\n  ')}`)
})

test('an optional input says what the tool does when it is left out', () => {
  // Most inputs on these tools are optional by design — "defaults to the
  // engagement in view", "omit for a clean run" — so leaving one out is the
  // ordinary path. Without a `when_omitted` the sentence renders a dash
  // there, which is how the procedure-areas card came to read "Adopt —
  // procedure areas for — from —" on every adoption.
  const silent = []
  for (const tool of TOOLS) {
    if (!tool.describe) continue
    const props = tool.input_schema?.properties ?? {}
    const required = tool.input_schema?.required ?? []
    for (const [, name] of tool.describe.matchAll(PLACEHOLDER)) {
      const prop = props[name]
      if (!prop || required.includes(name)) continue
      if (typeof prop.when_omitted !== 'string') silent.push(`${tool.name}: {${name}} is optional with no when_omitted`)
    }
  }
  assert.deepEqual(silent, [], `An omitted input renders as a dash on the card the user approves:\n  ${silent.join('\n  ')}`)
})

test('no gated sentence renders a dash when every optional input is left out', () => {
  // The end-to-end form of the two tests above: render each sentence exactly
  // as the Confirm card would for a call that passes only what it must.
  //
  // Substituted for the fallback rather than looking for an em dash in the
  // result, because two of these sentences use an em dash as punctuation —
  // "{kind} — {target}" — and a test that cannot tell the two apart reports a
  // correct sentence as broken.
  const FALLBACK = '\u0000gap\u0000'
  const dashed = []
  for (const tool of TOOLS.filter((t) => t.approval && t.describe)) {
    const props = tool.input_schema?.properties ?? {}
    const required = tool.input_schema?.required ?? []
    const given = Object.fromEntries(required.map((r) => [r, `<${r}>`]))
    const rendered = tool.describe.replace(PLACEHOLDER, (_, k) => {
      const v = given[k]
      return v === undefined ? (props[k]?.when_omitted ?? FALLBACK) : v
    })
    if (rendered.includes(FALLBACK)) dashed.push(`${tool.name}: ${rendered.replaceAll(FALLBACK, '—')}`)
  }
  assert.deepEqual(dashed, [], `A state change gated on approval asks about a dash:\n  ${dashed.join('\n  ')}`)
})

// That a tool names an agent, a surface and an object schema, and that a
// mutating one carries a sentence at all, is already required in
// converse.test.mjs. What is left is whether the sentence and the surfaces
// mean anything.

test('every surface a tool claims is one some role holds', () => {
  const held = new Set(Object.values(CATALOGUE.roles).flatMap((r) => r.surfaces))
  const orphaned = TOOLS
    .filter((t) => (t.surfaces ?? []).every((s) => !held.has(s)))
    .map((t) => t.name)
  assert.deepEqual(orphaned, [], 'A tool whose every surface is unheld can never be called')
})

test('no two tools share a name', () => {
  const seen = new Set()
  const duplicates = []
  for (const t of TOOLS) {
    if (seen.has(t.name)) duplicates.push(t.name)
    seen.add(t.name)
  }
  assert.deepEqual(duplicates, [], 'The later definition silently wins, and which one that is depends on file order')
})
