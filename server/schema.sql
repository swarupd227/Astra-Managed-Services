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

create index if not exists engagement_filed_item_kind on engagement_filed_item (engagement_id, kind, position);
create index if not exists engagement_service_line_order on engagement_service_line (engagement_id, position);
