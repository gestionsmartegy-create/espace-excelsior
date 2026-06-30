-- ============================================================
-- Espace Excelsior — module de réservation
-- Schéma Supabase (Postgres)
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- créneau demandé
  event_date      date not null,
  start_time      time not null,
  end_time        time not null,

  -- client
  customer_name   text not null,
  customer_email  text not null,
  customer_phone  text,
  guest_count     int,

  -- services choisis : [{ id, name, price_cents }]
  services        jsonb not null default '[]',
  total_cents     int not null default 0,
  deposit_cents   int not null default 0,

  -- statut du cycle de vie
  -- hold      → créneau retenu, en attente de paiement (expire si non payé)
  -- confirmed → paiement reçu, événement créé dans Google Calendar
  -- expired   → hold expiré sans paiement, jamais touché le calendrier
  -- cancelled → annulée après confirmation
  status          text not null default 'hold'
                    check (status in ('hold','confirmed','expired','cancelled')),

  hold_expires_at timestamptz not null default (now() + interval '20 minutes'),

  stripe_session_id text unique,
  stripe_payment_intent text,
  google_event_id text,

  notes           text
);

create index if not exists bookings_date_idx on bookings (event_date);
create index if not exists bookings_status_idx on bookings (status);

-- Un seul hold/confirmed actif par créneau (empêche le double-booking
-- même en cas de double-clic ou de requêtes concurrentes)
create unique index if not exists bookings_active_slot_idx
  on bookings (event_date, start_time)
  where status in ('hold','confirmed');

-- ============================================================
-- Nettoyage automatique des holds expirés — ne touche jamais
-- Google Calendar puisque les holds n'y sont jamais créés.
-- ============================================================
create or replace function expire_stale_holds()
returns void
language sql
as $$
  update bookings
  set status = 'expired'
  where status = 'hold'
    and hold_expires_at < now();
$$;

-- Nécessite l'extension pg_cron (activable dans Database → Extensions)
-- select cron.schedule('expire-holds', '*/5 * * * *', 'select expire_stale_holds();');

-- ============================================================
-- RLS — le frontend (clé anon) ne doit jamais lire/écrire
-- directement la table ; tout passe par les Edge Functions
-- (clé service_role, côté serveur uniquement).
-- ============================================================
alter table bookings enable row level security;
-- Aucune policy = aucun accès direct depuis le client. Volontaire.
