import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSync } from 'esbuild'

/* ==========================================================================
   Whether a licence request is read as what it says.

   The reader is the only thing here that decides a state change from somebody
   else's prose, so it is the one place where being approximately right is
   worse than refusing. Two failures matter and they pull against each other:
   reading a fault as a request spends a seat on a broken install, and failing
   a misspelling asks a question the ticket already answered.

   Every case below is real wording from Kearney's own extract — tab I1 of the
   volumes attachment, 63,350 requests, 1,812 of them mentioning a licence —
   except the near-miss words, which are here because an earlier version of
   the fuzzy match granted Alteryx for "Gallery licence request".

   The domain is browser TypeScript and the suite is Node, so it is bundled
   here rather than mirrored. A mirror would pass while the application failed.
   ========================================================================== */

const out = join(mkdtempSync(join(tmpdir(), 'astra-ent-')), 'entitlement.mjs')
buildSync({
  entryPoints: ['src/domain/entitlement.ts'],
  bundle: true, platform: 'node', format: 'esm', outfile: out,
  alias: { '@': './src' }, logLevel: 'error',
})
const { readLicenceRequest, PRODUCTS, UNPOOLED_PRODUCTS } = await import(`file://${out}`)

test('a misspelt pooled product is still that product', () => {
  // Every one of these is a real request title.
  const wrong = []
  for (const [text, want] of [
    ['Alterx license renew request', 'alteryx'],
    ['Alteyx license renew request', 'alteryx'],
    ['Altreyx License', 'alteryx'],
    ['User Needs Altery License', 'alteryx'],
    ['Add Alteryx licence', 'alteryx'],
    ['PowerBI License Request', 'powerbi_pro'],
    ['Power BI Pro License | Luis Otavio', 'powerbi_pro'],
  ]) {
    const got = readLicenceRequest(text).product?.id ?? null
    if (got !== want) wrong.push(`"${text}" read as ${got ?? 'no product'}, wanted ${want}`)
  }
  assert.deepEqual(wrong, [], wrong.join('\n  '))
})

test('a word that merely looks like a product is not that product', () => {
  // The guard on the fuzzy match. "Gallery" and "Battery" sat two edits from
  // the alias "altery" and were granted Alteryx seats.
  const granted = []
  for (const text of [
    'Gallery licence request', 'Battery licence', 'Lottery license',
    'Alteration to the licence group', 'Analytics licence query',
    'Anaplan XL License Activation', 'ArcGIS license request', 'Arixcel License Request',
    'Anaconda license request', 'Smartsheet licence request', 'Tableau license issue',
  ]) {
    const p = readLicenceRequest(text).product
    if (p) granted.push(`"${text}" → ${p.id}`)
  }
  assert.deepEqual(granted, [], `A seat would be spent on the wrong product:\n  ${granted.join('\n  ')}`)
})

test('something already broken is a fault, not a request for a seat', () => {
  const misread = []
  for (const text of [
    'Alteryx license issue', 'Windows License activation error', 'Tableau license issue',
    'Thinkcell showing expired license message', 'Office login error (license issue)',
    'Unable to Connect Alteryx to SharePoint (License Prompt)',
  ]) {
    const r = readLicenceRequest(text)
    if (!r.notARequest) misread.push(`"${text}" read as a ${r.type} request`)
  }
  assert.deepEqual(misread, [], `A seat would be spent on a fault:\n  ${misread.join('\n  ')}`)
})

test('an explicit ask outranks a fault word in the same sentence', () => {
  for (const text of ['Alteryx license key request', 'Issue of Excel license on my VM']) {
    assert.equal(readLicenceRequest(text).notARequest, null, text)
  }
})

test('a monitoring job is nobody asking for anything', () => {
  for (const text of [
    'O365 License Group - Group ID Jobs Failed',
    'INC0229089 -Update Notification O365 License Group - GroupID Job',
  ]) {
    assert.equal(readLicenceRequest(text).notARequest?.kind, 'platform_job', text)
  }
})

test('a term it cannot read is asked about, never defaulted', () => {
  const r = readLicenceRequest('User needs Altery License for a few weeks')
  assert.equal(r.termUnreadable, 'a few weeks')
  assert.ok(r.missing.includes('how long for'), 'must ask rather than grant the standard term')
})

test('a term it can read is read', () => {
  assert.equal(readLicenceRequest('Alteryx licence for 6 months').months, 6)
  assert.equal(readLicenceRequest('Power BI Pro for a year').months, 12)
  assert.equal(readLicenceRequest('Alteryx licence for 2 years').months, 24)
})

test('a product with no pool is refused, not asked about', () => {
  for (const [text, want] of [
    ['MS Visio license request', 'MS Visio'],
    ['Assign copiolt license', 'Microsoft Copilot'],
    ['AT Brian Short - Request for M365 CoPilot license', 'Microsoft Copilot'],
    ['ADOBE ACROBAT PRO LICENSE REQUEST', 'Adobe Acrobat'],
    ['ChatGPT license request', 'ChatGPT'],
  ]) {
    assert.equal(readLicenceRequest(text).unpooled, want, text)
  }
})

test('no unpooled product shares a name with a pooled one', () => {
  // A product in both lists would be refused for having no pool while its
  // seats sat unused.
  const pooled = new Set(PRODUCTS.flatMap((p) => [p.name.toLowerCase(), ...p.aliases]))
  const clash = UNPOOLED_PRODUCTS
    .filter((u) => u.aliases.some((a) => pooled.has(a)) || pooled.has(u.name.toLowerCase()))
    .map((u) => u.name)
  assert.deepEqual(clash, [], 'A pooled product must never also be listed as unpooled')
})
