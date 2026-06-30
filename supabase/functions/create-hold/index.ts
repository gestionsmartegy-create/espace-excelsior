// POST /create-hold
// body: { date, start_time, end_time, name, email, phone, guest_count, service_ids }
//
// 1. Insère un hold (expire dans 20 min) — la contrainte unique
//    bookings_active_slot_idx empêche deux holds sur le même créneau.
// 2. Crée une session Stripe Checkout pour l'acompte.
// 3. Renvoie l'URL de paiement au frontend.
//
// L'événement Google Calendar n'est PAS créé ici — seulement par
// le webhook Stripe, une fois le paiement confirmé.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { computeTotals } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { date, start_time, end_time, name, email, phone, guest_count, service_ids } = body;

    if (!date || !start_time || !end_time || !name || !email) {
      return json({ error: "Champs requis manquants" }, 400);
    }

    const { services, total_cents, deposit_cents } = computeTotals(service_ids ?? []);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // le constraint unique empêche un double-hold sur le même créneau
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
        services,
        total_cents,
        deposit_cents,
        status: "hold",
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return json({ error: "Ce créneau vient d'être réservé par quelqu'un d'autre." }, 409);
      }
      return json({ error: insertError.message }, 500);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: deposit_cents,
            product_data: {
              name: `Acompte — réservation Espace Excelsior (${date}, ${start_time})`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { booking_id: booking.id },
      success_url: `${Deno.env.get("SITE_URL")}/?reservation=succes`,
      cancel_url: `${Deno.env.get("SITE_URL")}/?reservation=annulee`,
      expires_at: Math.floor(Date.now() / 1000) + 20 * 60,
    });

    await supabase
      .from("bookings")
      .update({ stripe_session_id: session.id })
      .eq("id", booking.id);

    return json({ checkout_url: session.url, deposit_cents, total_cents });
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
