// Accès Google Calendar via un compte de service (Service Account).
// Le calendrier de la salle doit être partagé avec l'adresse e-mail
// du compte de service, avec droit "Apporter des modifications aux
// événements".
//
// Secrets requis (Supabase → Project Settings → Edge Functions → Secrets) :
//   GOOGLE_CLIENT_EMAIL   — e-mail du compte de service
//   GOOGLE_PRIVATE_KEY    — clé privée du compte de service (PEM)
//   GOOGLE_CALENDAR_ID    — id du calendrier de la salle

import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

const SCOPE = "https://www.googleapis.com/auth/calendar";

async function getAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL")!;
  const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")!.replace(/\\n/g, "\n");

  const key = await importPrivateKey(privateKeyPem);

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: clientEmail,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(60 * 60),
      iat: getNumericDate(0),
    },
    key
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`Google auth failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export async function getFreeBusy(timeMin: string, timeMax: string) {
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID")!;
  const token = await getAccessToken();

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
  });

  if (!res.ok) throw new Error(`FreeBusy failed: ${await res.text()}`);
  const data = await res.json();
  return data.calendars[calendarId].busy as { start: string; end: string }[];
}

export async function createCalendarEvent(opts: {
  summary: string;
  description: string;
  startDateTime: string; // ISO, ex 2026-08-15T18:00:00-04:00
  endDateTime: string;
}) {
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID")!;
  const token = await getAccessToken();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: opts.summary,
        description: opts.description,
        start: { dateTime: opts.startDateTime, timeZone: "America/Toronto" },
        end: { dateTime: opts.endDateTime, timeZone: "America/Toronto" },
      }),
    }
  );

  if (!res.ok) throw new Error(`createEvent failed: ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}

export async function deleteCalendarEvent(eventId: string) {
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID")!;
  const token = await getAccessToken();

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
}
