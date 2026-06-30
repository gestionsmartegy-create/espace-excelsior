// POST /create-hold
// body: { date, start_time, end_time, name, email, phone, guest_count,
//         event_type, service_ids }
//
// Étape "demande de date" : insère une ligne `inquiry`, sans paiement.
// L'équipe valide ensuite manuellement et déclenche la demande
// d'acompte (Stripe) dans un second temps — voir
// supabase/functions/request-deposit (à construire quand la facturation
// sera prête, voir supabase/README.md).
//
// La contrainte unique sur (event_date, start_time) empêche deux
// demandes actives (inquiry/confirmed) sur le même créneau, pour
// éviter de qualifier deux clients sur la même date sans le savoir.
//
// L'événement Google Calendar n'est créé qu'au moment de la
// confirmation finale (paiement reçu), jamais ici.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeTotals } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { date, start_time, end_time, name, email, phone, guest_count, event_type, service_ids } = body;

    if (!date || !start_time || !end_time || !name || !email) {
      return json({ error: "Champs requis manquants" }, 400);
    }

    const { services, total_cents, deposit_cents } = computeTotals(service_ids ?? []);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: booking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        event_date: date,
        start_time,
        end_time,
        customer_name: name,
        customer_email: email,
        customer_phone: phone ?? null,
        guest_count: guest_count ?? null,
        event_type: event_type ?? null,
        services,
        total_cents,
        deposit_cents,
        status: "hold", // = demande en attente de validation par l'équipe
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return json({ error: "Cette date et ce créneau sont déjà en cours de traitement pour un autre client." }, 409);
      }
      return json({ error: insertError.message }, 500);
    }

    // TODO : notifier l'équipe (e-mail/Slack) qu'une nouvelle demande
    // est arrivée, avec un lien vers la fiche `booking.id` à valider.

    return json({ ok: true, booking_id: booking.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
