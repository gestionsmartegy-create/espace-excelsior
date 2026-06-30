# Module de réservation — backend Supabase

Trois Edge Functions + une table Postgres. Le frontend (`assets/js/booking.js`)
ne parle jamais directement à Stripe ni à Google Calendar — tout passe par ici.

## 1. Créer le projet Supabase

1. [supabase.com](https://supabase.com) → New Project.
2. Une fois créé : **Project Settings → API** → noter `Project URL` et
   `service_role` key (jamais exposée au frontend, seulement aux Edge Functions).
3. **SQL Editor** → coller le contenu de `schema.sql` → Run.
4. **Database → Extensions** → activer `pg_cron`, puis dans le SQL Editor :
   ```sql
   select cron.schedule('expire-holds', '*/5 * * * *', 'select expire_stale_holds();');
   ```

## 2. Créer le compte de service Google

1. [console.cloud.google.com](https://console.cloud.google.com) → nouveau
   projet → activer l'API **Google Calendar API**.
2. **IAM & Admin → Service Accounts** → créer un compte de service →
   générer une clé **JSON**.
3. Dans le fichier JSON téléchargé, noter `client_email` et `private_key`.
4. Dans **Google Calendar** (calendrier de la salle) → Paramètres et partage →
   ajouter l'e-mail du compte de service avec le droit
   **"Apporter des modifications aux événements"**.
5. Noter l'ID du calendrier (Paramètres → "ID du calendrier").

## 3. Créer le compte Stripe

1. [stripe.com](https://stripe.com) → créer le compte (mode test pour
   commencer).
2. **Developers → API keys** → noter la clé secrète (`sk_test_...`).
3. **Developers → Webhooks → Add endpoint** :
   URL = `https://<project-ref>.functions.supabase.co/stripe-webhook`,
   événement à écouter : `checkout.session.completed`.
   Noter le **Signing secret** (`whsec_...`).

## 4. Configurer les secrets Supabase

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  GOOGLE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com \
  GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
  GOOGLE_CALENDAR_ID=xxxxx@group.calendar.google.com \
  SITE_URL=https://gestionsmartegy-create.github.io/espace-excelsior
```

## 5. Déployer les fonctions

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy check-availability --no-verify-jwt
supabase functions deploy create-hold --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` parce que ce sont des endpoints publics (le site est
statique, sans utilisateurs connectés) — la sécurité vient de la clé
`service_role` qui reste côté serveur, jamais exposée.

## 6. Brancher le frontend

Dans `assets/js/booking-config.js`, remplacer :

```js
const SUPABASE_FUNCTIONS_URL = "https://<project-ref>.functions.supabase.co";
```

## Ajuster les prix

Les tarifs sont définis à deux endroits qui doivent rester synchronisés :
- `supabase/functions/_shared/pricing.ts` (source de vérité, utilisée pour
  calculer le montant réellement chargé par Stripe)
- `assets/js/booking-config.js` (affichage côté frontend uniquement)

## Pourquoi pas de double-booking ?

- Contrainte unique Postgres sur `(event_date, start_time)` pour les statuts
  `hold`/`confirmed` → impossible d'insérer deux réservations actives sur le
  même créneau, même en cas de requêtes simultanées.
- Le hold expire après 20 minutes s'il n'est pas payé ; `expire_stale_holds()`
  le nettoie sans jamais avoir touché Google Calendar.
- L'événement Google Calendar n'est créé que par le webhook Stripe, donc
  uniquement quand l'argent est réellement reçu — jamais de réservation
  "fantôme" exportée par erreur.
