// Catalogue des services connexes — prix fixes en cents (CAD).
// ⚠️ Placeholders : à ajuster avec les vrais tarifs d'Espace Excelsior
// avant la mise en ligne. Garder ce fichier synchronisé avec
// assets/js/booking-config.js côté frontend (mêmes id et prix).

export const SERVICES = [
  { id: "salle", name: "Location de salle", price_cents: 80000, required: true },
  { id: "traiteur", name: "Traiteur", price_cents: 35000, required: false },
  { id: "dj", name: "DJ professionnel", price_cents: 45000, required: false },
  { id: "bar", name: "Service bar", price_cents: 30000, required: false },
  { id: "photobooth", name: "Photobooth", price_cents: 20000, required: false },
  { id: "decor", name: "Décor", price_cents: 15000, required: false },
] as const;

// Acompte demandé pour valider la réservation (le solde se règle
// séparément, hors ligne, avant ou le jour de l'événement).
export const DEPOSIT_PERCENT = 0.3; // 30 % du total
export const DEPOSIT_MIN_CENTS = 20000; // jamais moins de 200 $

export function computeTotals(selectedIds: string[]) {
  const ids = new Set(selectedIds);
  const required = SERVICES.filter((s) => s.required).map((s) => s.id);
  required.forEach((id) => ids.add(id));

  const services = SERVICES.filter((s) => ids.has(s.id));
  const total_cents = services.reduce((sum, s) => sum + s.price_cents, 0);
  const deposit_cents = Math.max(
    Math.round(total_cents * DEPOSIT_PERCENT),
    DEPOSIT_MIN_CENTS
  );

  return { services, total_cents, deposit_cents };
}
