// Configuration du module de réservation.
// ⚠️ À mettre à jour une fois le backend Supabase déployé
// (voir supabase/README.md).

const SUPABASE_FUNCTIONS_URL = "https://YOUR-PROJECT-REF.functions.supabase.co";

// Doit rester synchronisé avec supabase/functions/_shared/pricing.ts
const BOOKING_SERVICES = [
  { id: "salle", name: "Location de salle", price_cents: 80000, required: true },
  { id: "traiteur", name: "Traiteur", price_cents: 35000, required: false },
  { id: "dj", name: "DJ professionnel", price_cents: 45000, required: false },
  { id: "bar", name: "Service bar", price_cents: 30000, required: false },
  { id: "photobooth", name: "Photobooth", price_cents: 20000, required: false },
  { id: "decor", name: "Décor", price_cents: 15000, required: false },
];

const DEPOSIT_PERCENT = 0.3;
const DEPOSIT_MIN_CENTS = 20000;
