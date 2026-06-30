// GET /check-availability?date=2026-08-15
//
// Renvoie les créneaux libres pour une date donnée, en croisant :
//  1. les réservations déjà confirmées/en hold dans Supabase
//  2. le FreeBusy de Google Calendar (filet de sécurité si un
//     événement a été ajouté manuellement au calendrier)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFreeBusy } from "../_shared/google-calendar.ts";

const SLOTS = [
  { start: "11:00", end: "16:00", label: "Jour — 11h à 16h" },
  { start: "18:00", end: "23:00", label: "Soir — 18h à 23h" },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(JSON.stringify({ error: "Paramètre 'date' requis (YYYY-MM-DD)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. créneaux déjà pris dans Supabase (hold non expiré ou confirmé)
  const { data: taken, error } = await supabase
    .from("bookings")
    .select("start_time")
    .eq("event_date", date)
    .in("status", ["hold", "confirmed"]);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const takenStarts = new Set((taken ?? []).map((b) => b.start_time.slice(0, 5)));

  // 2. filet de sécurité Google Calendar
  let busy: { start: string; end: string }[] = [];
  try {
    busy = await getFreeBusy(`${date}T00:00:00-04:00`, `${date}T23:59:59-04:00`);
  } catch (_e) {
    // si Google est indisponible, on se rabat sur Supabase seul
  }

  const available = SLOTS.filter((slot) => {
    if (takenStarts.has(slot.start)) return false;
    const slotStart = new Date(`${date}T${slot.start}:00-04:00`).getTime();
    const slotEnd = new Date(`${date}T${slot.end}:00-04:00`).getTime();
    return !busy.some((b) => {
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();
      return slotStart < bEnd && slotEnd > bStart;
    });
  });

  return new Response(JSON.stringify({ date, slots: available }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
