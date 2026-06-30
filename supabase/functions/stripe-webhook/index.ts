// POST /stripe-webhook — appelé directement par Stripe, jamais par le frontend.
//
// Sur checkout.session.completed :
//   1. marque le booking "confirmed"
//   2. crée l'événement dans Google Calendar
//   3. stocke le google_event_id (pour pouvoir l'annuler plus tard)
//
// Si la création Google Calendar échoue, le booking reste "confirmed"
// (le client a payé) mais sans google_event_id — un cas à surveiller
// manuellement plutôt que de laisser un paiement orphelin.
//
// Configurer ce endpoint dans Stripe → Developers → Webhooks, et
// mettre le "Signing secret" dans STRIPE_WEBHOOK_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createCalendarEvent } from "../_shared/google-calendar.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    return new Response(`Signature invalide: ${err}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ignored", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) return new Response("pas de booking_id", { status: 200 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (!booking || booking.status === "confirmed") {
    // déjà traité (Stripe peut renvoyer le même webhook plusieurs fois)
    return new Response("ok", { status: 200 });
  }

  // marquer payé d'abord — le paiement est réel même si Calendar échoue ensuite
  await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      stripe_payment_intent: session.payment_intent as string,
    })
    .eq("id", bookingId);

  try {
    const serviceNames = (booking.services as { name: string }[])
      .map((s) => s.name)
      .join(", ");

    const eventId = await createCalendarEvent({
      summary: `Réservation — ${booking.customer_name}`,
      description: `Services : ${serviceNames}\nInvités : ${booking.guest_count ?? "n/d"}\nTéléphone : ${booking.customer_phone ?? "n/d"}\nCourriel : ${booking.customer_email}`,
      startDateTime: `${booking.event_date}T${booking.start_time}-04:00`,
      endDateTime: `${booking.event_date}T${booking.end_time}-04:00`,
    });

    await supabase.from("bookings").update({ google_event_id: eventId }).eq("id", bookingId);
  } catch (e) {
    console.error("Échec création événement Google Calendar:", e);
    // à surveiller : paiement confirmé mais événement pas créé.
    // Prévoir une alerte (email/Slack) ici en production.
  }

  return new Response("ok", { status: 200 });
});
