-- ===========================================================================
-- The engagements as they stood in code on the day they moved.
--
-- Every value here was a TypeScript literal before. Nothing is invented and
-- nothing is improved in transit: the point of the move is that the terms
-- become editable, not that they change. Safe to run twice — a row that
-- exists is updated to match, so re-running restores the filed position
-- without duplicating anything.
-- ===========================================================================

insert into engagement (id, client, industry, regions, currency, stage, term_months, starts_at, baseline_hrs_year, cost_reduction_pct, note) values
  ('eng_kearney', 'Kearney', 'Management consulting', 'Global · 40 offices', 'USD', 'run', 60, '2026-04-01', 214000, 12, 'Towers in Run; two still in transition'),
  ('eng_harbour', 'Harbour Mutual', 'Insurance', 'Singapore, United Kingdom', 'SGD', 'bid', 36, '2027-07-01', null, null, 'Bid stage: contract terms loaded, no estate ingested')
on conflict (id) do update set
  client = excluded.client, industry = excluded.industry, regions = excluded.regions,
  currency = excluded.currency, stage = excluded.stage, term_months = excluded.term_months,
  starts_at = excluded.starts_at, baseline_hrs_year = excluded.baseline_hrs_year,
  cost_reduction_pct = excluded.cost_reduction_pct, note = excluded.note, updated_at = now();

insert into engagement_regime (engagement_id, name, response_days, extension_days, client_notice_hrs, regulator_notice_hrs, adequate) values
  ('eng_kearney', 'GDPR', 30, 60, 24, 72, '{EEA,UK,CH,JP,KR,CA,NZ,IL}'),
  ('eng_harbour', 'PDPA + UK GDPR', 30, 30, 12, 72, '{UK,EEA,SG}')
on conflict (engagement_id) do update set
  name = excluded.name, response_days = excluded.response_days, extension_days = excluded.extension_days,
  client_notice_hrs = excluded.client_notice_hrs, regulator_notice_hrs = excluded.regulator_notice_hrs,
  adequate = excluded.adequate;

insert into engagement_ingested (engagement_id, contract, inventory, tickets, estate, telemetry) values
  ('eng_kearney', true, true, true, true, true),
  ('eng_harbour', true, false, false, false, false)
on conflict (engagement_id) do update set
  contract = excluded.contract, inventory = excluded.inventory, tickets = excluded.tickets,
  estate = excluded.estate, telemetry = excluded.telemetry;

insert into engagement_service_line (engagement_id, id, name, pack_id, position) values
  ('eng_kearney', 'B1', 'Digital Workplace Services', 'pack_workplace', 1),
  ('eng_kearney', 'B2', 'Infrastructure Services', 'pack_infra', 2),
  ('eng_kearney', 'B3', 'Application Management Services', 'pack_apps', 3),
  ('eng_kearney', 'B4', 'Data Management Services', 'pack_data', 4),
  ('eng_kearney', 'B5', 'Cross-Functional Services', 'pack_cross', 5),
  ('eng_harbour', 'L1', 'Application Services', 'pack_apps', 1),
  ('eng_harbour', 'L2', 'Cloud & Platform', 'pack_infra', 2),
  ('eng_harbour', 'L3', 'Data & Analytics', 'pack_data', 3),
  ('eng_harbour', 'L4', 'Security Operations', 'pack_security', 4)
on conflict (engagement_id, id) do update set
  name = excluded.name, pack_id = excluded.pack_id, position = excluded.position;

insert into engagement_threshold (engagement_id, key, value, stated_in) values
  ('eng_kearney', 'recommendationWindowDays', 90, 'Table 1, item 1'),
  ('eng_kearney', 'procedureReviewDays', 180, 'Attachment B.3, item 1'),
  ('eng_harbour', 'recommendationWindowDays', 60, 'Schedule 4'),
  ('eng_harbour', 'procedureReviewDays', 90, 'Schedule 4'),
  ('eng_harbour', 'recurringClusterThreshold', 5, 'Schedule 4')
on conflict (engagement_id, key) do update set value = excluded.value, stated_in = excluded.stated_in;

insert into engagement_filed_item (engagement_id, kind, id, name, standard_id, reference, position) values
  ('eng_kearney', 'procedure_area', 'ka_triage', 'Incident triage', 'sa_triage', 'Attachment B.3 — Application Management, item 1', 1),
  ('eng_kearney', 'procedure_area', 'ka_escalation', 'Escalation', 'sa_escalation', 'Attachment B.3 — Application Management, item 1', 2),
  ('eng_kearney', 'procedure_area', 'ka_corrective', 'Corrective maintenance', 'sa_corrective', 'Attachment B.3 — Application Management, item 1', 3),
  ('eng_kearney', 'procedure_area', 'ka_problem', 'Problem management', 'sa_problem', 'Attachment B.3 — Application Management, item 1', 4),
  ('eng_kearney', 'procedure_area', 'ka_release', 'Release support', 'sa_release', 'Attachment B.3 — Application Management, item 1', 5),
  ('eng_kearney', 'procedure_area', 'ka_regression', 'Regression testing', 'sa_regression', 'Attachment B.3 — Application Management, item 1', 6),
  ('eng_kearney', 'procedure_area', 'ka_patching', 'Patching', 'sa_patching', 'Attachment B.3 — Application Management, item 1', 7),
  ('eng_kearney', 'procedure_area', 'ka_saas', 'SaaS coordination', 'sa_saas', 'Attachment B.3 — Application Management, item 1', 8),
  ('eng_kearney', 'procedure_area', 'ka_config', 'Configuration changes', 'sa_config', 'Attachment B.3 — Application Management, item 1', 9),
  ('eng_kearney', 'procedure_area', 'ka_knowledge', 'Knowledge capture', 'sa_knowledge', 'Attachment B.3 — Application Management, item 1', 10),
  ('eng_kearney', 'procedure_area', 'ka_handoff', 'Service handoffs', 'sa_handoff', 'Attachment B.3 — Application Management, item 1', 11),
  ('eng_kearney', 'improvement_dimension', 'kd_capability', 'Platform capabilities', 'platform_capability', 'Table 1 — Enterprise Data Platform, Data Governance & Quality, and Data Integration & Pipelines, item 1', 1),
  ('eng_kearney', 'improvement_dimension', 'kd_quality', 'Data quality', 'data_quality', 'Table 1 — Enterprise Data Platform, Data Governance & Quality, and Data Integration & Pipelines, item 1', 2),
  ('eng_kearney', 'improvement_dimension', 'kd_automation', 'Automation', 'automation', 'Table 1 — Enterprise Data Platform, Data Governance & Quality, and Data Integration & Pipelines, item 1', 3),
  ('eng_kearney', 'improvement_dimension', 'kd_performance', 'Performance', 'performance', 'Table 1 — Enterprise Data Platform, Data Governance & Quality, and Data Integration & Pipelines, item 1', 4),
  ('eng_kearney', 'improvement_dimension', 'kd_security', 'Security', 'security', 'Table 1 — Enterprise Data Platform, Data Governance & Quality, and Data Integration & Pipelines, item 1', 5),
  ('eng_kearney', 'improvement_dimension', 'kd_efficiency', 'Operational efficiency', 'operational_efficiency', 'Table 1 — Enterprise Data Platform, Data Governance & Quality, and Data Integration & Pipelines, item 1', 6)
on conflict (engagement_id, kind, id) do update set
  name = excluded.name, standard_id = excluded.standard_id,
  reference = excluded.reference, position = excluded.position;
