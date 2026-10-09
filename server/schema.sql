-- ===========================================================================
-- The engagement's own terms, held where they can be changed.
--
-- One table per thing a contract states, rather than a document column with
-- JSON in it: a threshold nobody can query is barely better than a threshold
-- nobody can see. Everything here was a literal in TypeScript before, and
-- the migration that fills it is the same values, so nothing changes on the
-- day it moves.
--
-- Applied by `npm run db:migrate`, which is safe to run twice.
-- ===========================================================================

create table if not exists engagement (
  id                text primary key,
  client            text not null,
  industry          text not null,
  regions           text not null,
  currency          text not null,
  stage             text not null,
  term_months       integer not null,
  starts_at         date not null,
  baseline_hrs_year integer,
  cost_reduction_pct numeric,
  note              text not null default '',
  updated_at        timestamptz not null default now()
);

create table if not exists engagement_regime (
  engagement_id        text primary key references engagement(id) on delete cascade,
  name                 text not null,
  response_days        integer not null,
  extension_days       integer not null,
  client_notice_hrs    integer not null,
  regulator_notice_hrs integer not null,
  adequate             text[] not null default '{}'
);

create table if not exists engagement_ingested (
  engagement_id text primary key references engagement(id) on delete cascade,
  contract   boolean not null default false,
  inventory  boolean not null default false,
  tickets    boolean not null default false,
  estate     boolean not null default false,
  telemetry  boolean not null default false
);

create table if not exists engagement_service_line (
  engagement_id text not null references engagement(id) on delete cascade,
  id            text not null,
  name          text not null,
  pack_id       text not null,
  position      integer not null default 0,
  primary key (engagement_id, id)
);

-- The numbers that decide behaviour. A row here overrides the platform's
-- default; an absent row means the platform's default stands.
create table if not exists engagement_threshold (
  engagement_id text not null references engagement(id) on delete cascade,
  key           text not null,
  value         numeric not null,
  stated_in     text,
  primary key (engagement_id, key)
);

-- The areas a contract names, in its own words and its own order.
create table if not exists engagement_filed_item (
  engagement_id text not null references engagement(id) on delete cascade,
  kind          text not null check (kind in ('procedure_area', 'improvement_dimension')),
  id            text not null,
  name          text not null,
  standard_id   text,
  reference     text not null,
  position      integer not null default 0,
  primary key (engagement_id, kind, id)
);

-- ---------------------------------------------------------------------------
-- What the contract obliges, recurring.
--
-- Only the contract's side of an obligation lives here: what is owed, how
-- often, what evidence discharges it, the clause it comes from, and the first
-- date it fell due. Those are terms, so they are loaded like any other term.
--
-- Deliberately absent: who owns it and whether it is green. An owner is an
-- assignment somebody makes and the platform records; a state is derived from
-- the date it is next due and what has been produced against it. Ten
-- obligations used to be compiled in with an owner's name and a RAG state
-- apiece, which made the register read as a live control when it was a
-- hand-written table.
-- ---------------------------------------------------------------------------
create table if not exists engagement_obligation (
  engagement_id        text not null references engagement(id) on delete cascade,
  id                   text not null,
  title                text not null,
  cadence              text not null check (cadence in ('Monthly', 'Quarterly', 'Half-yearly', 'Yearly')),
  evidence_requirement text not null,
  reference            text not null,
  first_due            date not null,
  position             integer not null default 0,
  primary key (engagement_id, id)
);

-- ---------------------------------------------------------------------------
-- Which generation of records a browser is holding.
--
-- The records are shared per engagement, so a browser keeps its own copy and
-- saves what the database does not have yet. That is union-merge, and it is
-- right for two people recording at once — but it makes a reset impossible to
-- hold: the clear empties the table, and the next save from any other tab
-- still holding the old rows writes every one of them straight back, while
-- reporting success to the person who asked for the reset.
--
-- So a clear bumps the generation. A save carries the generation it read, and
-- one from an older generation is refused rather than merged. The stale
-- browser is told, drops what it holds and reloads. The invariant is simply
-- that a write may only carry records from the generation it read.
-- ---------------------------------------------------------------------------
create table if not exists record_epoch (
  engagement_id text primary key references engagement(id) on delete cascade,
  epoch         integer not null default 1,
  cleared_at    timestamptz,
  cleared_by    text
);

create index if not exists engagement_filed_item_kind on engagement_filed_item (engagement_id, kind, position);
create index if not exists engagement_service_line_order on engagement_service_line (engagement_id, position);
create index if not exists engagement_obligation_order on engagement_obligation (engagement_id, position);

-- ===========================================================================
-- What people record.
--
-- One append-only table rather than one per register. These are events — a
-- notice given, a directive set, a pack produced — and they are read
-- wholesale by the application rather than queried across. A row is never
-- updated and never deleted; two browsers recording at once converge on the
-- union rather than overwriting each other, which is the whole reason this
-- is not a blob per session.
--
-- `identity_verified` is false while the role is chosen from a picker rather
-- than proven by a sign-in. It is a column rather than an assumption so that
-- turning on authentication later upgrades the record instead of migrating
-- around a claim that was never true.
-- ===========================================================================

create table if not exists record (
  engagement_id     text not null references engagement(id) on delete cascade,
  kind              text not null,
  key               text not null,
  payload           jsonb not null,
  recorded_by       text not null,
  recorded_role     text not null,
  identity_verified boolean not null default false,
  recorded_at       timestamptz not null default now(),
  primary key (engagement_id, kind, key)
);

create index if not exists record_kind on record (engagement_id, kind, recorded_at);

-- ===========================================================================
-- The client's ticket history, as ingested from the extract it was supplied in.
--
-- Themes and clusters are rows rather than JSON because they are the two
-- things worth asking questions of: which phrasing recurs, what it costs,
-- whether anything is costed against it. The shape figures are a fixed set of
-- scalars and sit on the history itself.
--
-- `limitation` is the part most registers would leave out: what this extract
-- cannot answer. A measure that needs one of these is refused rather than
-- estimated, so the reason has to travel with the data.
-- ===========================================================================

create table if not exists ticket_history (
  engagement_id   text primary key references engagement(id) on delete cascade,
  source          text not null,
  period_from     date not null,
  period_to       date not null,
  period_months   numeric not null,
  incidents       integer not null,
  requests        integer not null,
  problems        integer not null,
  catalogue_tasks integer not null,
  scope_rule      text not null,
  in_scope        integer not null,
  in_scope_pct    numeric not null,
  sub_categories  integer not null,
  top5_pct        numeric not null,
  top16_pct       numeric not null,
  singletons      integer not null,
  out_of_hours_pct numeric not null,
  weekend_pct     numeric not null,
  repeat_pct      numeric not null,
  clusters_over_ten integer not null,
  cluster_share_pct numeric not null,
  human_raised_pct  numeric not null,
  still_open_pct    numeric not null,
  off_inventory_pct numeric not null,
  off_inventory     integer not null,
  problem_records   integer not null,
  problems_open     integer not null,
  without_problem_pct numeric not null,
  growth_first_half integer not null,
  growth_second_half integer not null,
  growth_pct        numeric not null,
  ingested_at     timestamptz not null default now()
);

create table if not exists ticket_scope_line (
  engagement_id text not null references engagement(id) on delete cascade,
  id            text not null,
  name          text not null,
  incidents     integer not null,
  primary key (engagement_id, id)
);

create table if not exists ticket_theme (
  engagement_id  text not null references engagement(id) on delete cascade,
  id             text not null,
  name           text not null,
  incidents      integer not null,
  pct_of_inscope numeric not null,
  class_ids      text[] not null default '{}',
  position       integer not null default 0,
  primary key (engagement_id, id)
);

create table if not exists ticket_cluster (
  engagement_id text not null references engagement(id) on delete cascade,
  id            text not null,
  example       text not null,
  sub_category  text not null,
  incidents     integer not null,
  months        integer not null,
  class_id      text,
  primary key (engagement_id, id)
);

create table if not exists ticket_limitation (
  engagement_id text not null references engagement(id) on delete cascade,
  what          text not null,
  because       text not null,
  primary key (engagement_id, what)
);

create index if not exists ticket_cluster_size on ticket_cluster (engagement_id, incidents desc);

-- ===========================================================================
-- The client's incidents themselves, and the configuration that reads them.
--
-- The aggregates above describe demand. They cannot be used to take a ticket:
-- the intake needs an arrival, with a reference, a sub-category and a
-- timestamp, and until these tables existed there was no arrival anywhere in
-- the platform to show it. Invented samples stood in for them.
--
-- `ticket_feed` is why this is a platform rather than one client's loader.
-- Which column in a dump feeds which field is held here, per engagement, as
-- the mapping a person confirmed — not in the code, because the next client's
-- export will not spell its columns the way this one does. The same goes for
-- `ticket_feed_priority`: "5 - Planning" means P4 in this client's scheme and
-- nothing at all in another's.
--
-- `ticket_subcategory` carries two different kinds of thing on purpose, and
-- the difference matters. `incidents` is counted from the dump. `class_id` and
-- `node_ids` are declared by a person: which costed class this sub-category's
-- demand belongs to, and which component in the estate it lands on. A
-- re-ingest recounts the first and must not touch the second, because the
-- declaration is the part nobody can derive and the part that decides which
-- tower, and therefore which approval policy, a ticket arrives under.
-- ===========================================================================

create table if not exists ticket_feed (
  engagement_id text primary key references engagement(id) on delete cascade,
  system        text not null,
  source        text,
  column_map    jsonb not null,
  -- What the profiler said about each proposed column, kept so a reviewer can
  -- see whether a field was matched on its name or only on its values.
  because       jsonb not null default '{}',
  confirmed_by  text not null,
  confirmed_at  timestamptz not null default now(),
  rows_ingested integer not null default 0,
  unreadable    integer not null default 0,
  folded_rows   integer not null default 0
);

create table if not exists ticket_feed_priority (
  engagement_id text not null references engagement(id) on delete cascade,
  value         text not null,
  priority      text not null,
  primary key (engagement_id, value)
);

create table if not exists ticket (
  engagement_id     text not null references engagement(id) on delete cascade,
  ref               text not null,
  short_description text not null default '',
  category          text not null default '',
  sub_category      text not null default '',
  state             text not null default '',
  -- The client's own word for the priority, and what it was declared to mean.
  -- Keeping both means a disputed translation can be settled from the row.
  priority_raw      text not null default '',
  priority          text,
  assignment_group  text not null default '',
  reported_by       text not null default '',
  opened_at         timestamptz not null,
  primary key (engagement_id, ref)
);

create index if not exists ticket_arrival on ticket (engagement_id, opened_at desc);
create index if not exists ticket_filed_under on ticket (engagement_id, lower(category), lower(sub_category));

create table if not exists ticket_subcategory (
  engagement_id text not null references engagement(id) on delete cascade,
  -- Case-folded, because the dumps file the same category both ways and a
  -- capital letter must not split one sub-category's volume in two.
  key           text not null,
  category      text not null,
  sub_category  text not null,
  incidents     integer not null,
  class_id      text,
  node_ids      text[] not null default '{}',
  declared_by   text,
  primary key (engagement_id, key)
);

create index if not exists ticket_subcategory_size on ticket_subcategory (engagement_id, incidents desc);
