import type { CohortRule } from './aiIncident'

/**
 * The cohorts the discriminatory-pattern monitor compares. These are estate
 * data, not platform logic: an office footprint, matched on the work titles
 * the estate produces. Anything unmatched is compared as the remainder.
 */
export const COHORTS: CohortRule[] = [
  { id: 'americas', label: 'Americas offices', test: /Chicago|New York|Toronto|Mexico City|S[aã]o Paulo|Washington|Boston|Atlanta|Americas/i },
  { id: 'emea', label: 'EMEA offices', test: /London|Paris|Berlin|Munich|D[uü]sseldorf|Madrid|Milan|Amsterdam|Stockholm|Dubai|Riyadh|Johannesburg|Copenhagen|Oslo|Helsinki|Warsaw|Prague|EMEA/i },
  { id: 'apac', label: 'APAC offices', test: /Singapore|Tokyo|Sydney|Melbourne|Mumbai|New Delhi|Gurgaon|Bangalore|Bengaluru|Shanghai|Beijing|Hong Kong|Seoul|Kuala Lumpur|Jakarta|Manila|APAC/i },
]
