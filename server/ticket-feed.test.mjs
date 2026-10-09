import test from 'node:test'
import assert from 'node:assert/strict'
import { countSubCategories, mapRows, profile, proposePriorities, readDelimited, sniffDelimiter } from './ticket-feed.mjs'

/* ==========================================================================
   Whether a dump can be read without knowing whose dump it is.

   The claim this file has to defend is that no client's column names are
   installed in the platform. The way to test that is not to re-read the dump
   the code was written against — it would pass by construction — but to hand
   the profiler an export shaped like a different system entirely, with
   different headers, a different delimiter, a different priority vocabulary
   and its columns in a different order, and require it to arrive at the same
   eight fields.
   ========================================================================== */

/** A ServiceNow-shaped export: comma-separated, columns as that system names them. */
const SERVICENOW = [
  'INC,Short Description,Category,Sub Category,contact_type,state,priority,Assignment Group,sys_created_on',
  'INC0074675,IEM Login Issue,Applications,IEM,Chat,Closed,5 - Planning,WW_AG_APPS,2025-11-19 15:51:00',
  'INC0074676,Account locked after MFA prompt,Security,Account Lock-Out,Phone,Closed,3 - Moderate,WW_AG_GHD,2025-11-20 08:02:00',
  'INC0074677,Onedrive sync issue,Software,M365 - OneDrive,Chat,Closed,5 - Planning,WW_AG_GHD,2025-11-20 09:14:00',
  'INC0074678,Account lock-out again,security,account lock-out,Email,Closed,4 - Low,WW_AG_GHD,2025-11-21 11:00:00',
].join('\n')

/** The same incidents as a different system would hand them over. */
const OTHER_SYSTEM = [
  'Owning Team;Status;Key;Severity;Raised By;Created;Summary;Service;Component',
  'Platform Ops;Resolved;TCK-100045;Sev-2 (High);A. Nolan;14/01/2026 09:12;Mailbox quota exceeded on a shared mailbox;Messaging;Exchange',
  'Platform Ops;Resolved;TCK-100046;Sev-4 (Low);B. Ferraro;15/01/2026 10:40;Password reset needed after leave;Identity;Account Lock-Out',
  'Service Desk;Open;TCK-100047;Sev-1 (Critical);C. Idowu;16/01/2026 14:05;Payroll interface has stopped posting;Finance;Interfaces',
  'Service Desk;Resolved;TCK-100048;Sev-4 (Low);D. Kaur;17/01/2026 08:20;Laptop will not join the network;Workplace;Connectivity',
].join('\n')

test('a comma-separated export and a semicolon-separated one are both read', () => {
  assert.equal(sniffDelimiter(SERVICENOW), ',')
  assert.equal(sniffDelimiter(OTHER_SYSTEM), ';')
})

test('the fields the intake needs are found in an export the code has never seen', () => {
  const rows = readDelimited(OTHER_SYSTEM, sniffDelimiter(OTHER_SYSTEM))
  const p = profile(rows)

  // Not a single one of these column names appears anywhere in the platform.
  assert.equal(p.columnMap.ref, 'Key')
  assert.equal(p.columnMap.openedAt, 'Created')
  assert.equal(p.columnMap.shortDescription, 'Summary')
  assert.equal(p.columnMap.state, 'Status')
  assert.equal(p.columnMap.priority, 'Severity')
  assert.equal(p.columnMap.assignmentGroup, 'Owning Team')
  assert.equal(p.columnMap.reportedBy, 'Raised By')
  assert.deepEqual(p.missing, [], 'nothing the intake cannot do without is left unresolved')
})

test('the other system’s priority words translate to the platform’s four levels', () => {
  const proposed = proposePriorities(['Sev-1 (Critical)', 'Sev-2 (High)', 'Sev-4 (Low)', 'Whenever'])
  assert.deepEqual(
    proposed.map((p) => [p.value, p.priority]),
    [['Sev-1 (Critical)', 'P1'], ['Sev-2 (High)', 'P2'], ['Sev-4 (Low)', 'P4'], ['Whenever', null]],
  )
  // The one it cannot read is left for a person rather than guessed at.
  assert.match(proposed[3].because, /nothing in "Whenever" says which/)
})

test('a day-first date is not read as a month-first one', () => {
  const rows = readDelimited(OTHER_SYSTEM, ';')
  const p = profile(rows)
  const { tickets } = mapRows(rows, p.columnMap)
  // 14/01/2026 is January, not the fourteenth month.
  assert.equal(tickets[0].openedAt, '2026-01-14T09:12:00.000Z')
})

test('a column of timestamps is never proposed as the person who reported it', () => {
  // Two date columns, one of them unhelpfully named. Without the guard the
  // second is distinct enough and long enough to be taken for a caller.
  const rows = readDelimited([
    'Ref,Opened,Year,Summary',
    'INC001,2026-01-14 09:12,2026-01-14 09:12,Mailbox quota exceeded on a shared mailbox',
    'INC002,2026-01-15 10:40,2026-01-15 10:40,Password reset needed after a period of leave',
  ].join('\n'))
  const p = profile(rows)
  assert.equal(p.columnMap.openedAt, 'Opened')
  assert.notEqual(p.columnMap.reportedBy, 'Year')
})

test('a header that lies is overruled by the values behind it', () => {
  const rows = readDelimited([
    'Ref,Date,Summary',
    'INC001,not a date at all,Mailbox quota exceeded on a shared mailbox',
    'INC002,nor is this one,Password reset needed after a period of leave',
  ].join('\n'))
  const p = profile(rows)
  // Called Date, holds no dates, so it is not the timestamp — and since the
  // intake cannot run without one, that is reported rather than papered over.
  assert.notEqual(p.columnMap.openedAt, 'Date')
  assert.ok(p.missing.includes('openedAt'))
})

test('a row with no reference or no readable timestamp is set aside, not dropped', () => {
  // Under a confirmed mapping, which is how the ingest reads a dump: the
  // mapping is a decision already taken, so a few malformed rows change which
  // rows load and not how the dump is read.
  const rows = readDelimited([
    'INC,sys_created_on,Short Description',
    ...Array.from({ length: 10 }, (_, i) => `INC007467${i},2025-11-${10 + i} 15:51:00,A ticket that is entirely readable`),
    ',2025-11-20 08:02:00,A ticket with no reference at all on it',
    'INC0074680,,A ticket whose timestamp is missing entirely',
  ].join('\n'))
  const { tickets, unreadable } = mapRows(rows, {
    ref: 'INC', openedAt: 'sys_created_on', shortDescription: 'Short Description',
  })
  assert.equal(tickets.length, 10)
  assert.equal(unreadable.length, 2)
  assert.deepEqual(unreadable.map((u) => u.because), ['no reference', 'no readable timestamp'])
})

test('a reference column too empty to be one is not proposed as the reference', () => {
  // The other side of the same coin: two thirds filled is not a reference
  // column, and the profiler has to say so rather than map it and then
  // discard most of the dump as unreadable.
  const rows = readDelimited([
    'INC,sys_created_on,Short Description',
    'INC0074675,2025-11-19 15:51:00,A ticket that is entirely readable',
    ',2025-11-20 08:02:00,A ticket with no reference at all on it',
    ',2025-11-21 08:02:00,Another ticket with no reference on it',
  ].join('\n'))
  const p = profile(rows)
  assert.ok(p.missing.includes('ref'))
})

test('a sub-category filed in two different cases is counted once', () => {
  const rows = readDelimited(SERVICENOW)
  const p = profile(rows)
  const { tickets } = mapRows(rows, p.columnMap)
  const counted = countSubCategories(tickets)

  const lockouts = counted.rows.find((r) => r.key === 'security|account lock-out')
  assert.equal(lockouts.incidents, 2, 'Security and security are the same category')
  // And it reads back in the spelling the client used most, not a normalised one.
  assert.equal(lockouts.category, 'Security')
  assert.equal(counted.foldedKeys, 1)
  assert.equal(counted.foldedRows, 1)
})

test('the client’s own word for a priority is kept alongside what it was declared to mean', () => {
  const rows = readDelimited(SERVICENOW)
  const p = profile(rows)
  const { tickets } = mapRows(rows, p.columnMap, { '5 - Planning': 'P4', '3 - Moderate': 'P3' })
  assert.equal(tickets[0].priorityRaw, '5 - Planning')
  assert.equal(tickets[0].priority, 'P4')
  // A value the configuration does not translate leaves the field empty
  // rather than defaulting to a level nobody chose.
  assert.equal(tickets[3].priorityRaw, '4 - Low')
  assert.equal(tickets[3].priority, null)
})

test('a description containing a newline stays one ticket', () => {
  const rows = readDelimited(
    'INC,sys_created_on,Short Description\n' +
    'INC0074675,2025-11-19 15:51:00,"Login failed\nand the password had expired"\n' +
    'INC0074676,2025-11-20 08:02:00,Account locked after an MFA prompt\n',
  )
  assert.equal(rows.length, 3, 'two tickets and a header, not three tickets')
  const { tickets } = mapRows(rows, profile(rows).columnMap)
  assert.equal(tickets.length, 2)
  assert.match(tickets[0].shortDescription, /Login failed\nand the password/)
})
