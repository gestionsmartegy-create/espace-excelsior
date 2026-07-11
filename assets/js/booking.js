// Module de réservation — envoie la demande par courriel via FormSubmit
// (https://formsubmit.co), sans paiement ni backend. L'équipe reçoit
// toutes les infos et confirme la disponibilité par retour de courriel.
//
// Première soumission : FormSubmit envoie un courriel d'activation à
// BOOKING_EMAIL — cliquer le lien une seule fois, ensuite tout arrive
// directement dans la boîte.
//
// Le backend Supabase (dossier supabase/) reste prêt pour plus tard :
// disponibilités en direct + acompte Stripe.

const BOOKING_EMAIL = "info@espaceexcelsior.com";

const BOOKING_SLOTS = [
  { start: "11:00", end: "16:00", label: "Jour — 11h à 16h" },
  { start: "18:00", end: "23:00", label: "Soir — 18h à 23h" },
  { start: "11:00", end: "23:00", label: "Journée complète" },
];

(function () {
  const root = document.getElementById("reservation");
  if (!root) return;

  const dateInput = root.querySelector("#book-date");
  const slotsWrap = root.querySelector("#book-slots");
  const servicesWrap = root.querySelector("#book-services");
  const form = root.querySelector("#book-form");
  const submitBtn = root.querySelector("#book-submit");
  const statusEl = root.querySelector("#book-status");

  let selectedSlot = null;

  // date minimale : demain
  const tomorrow = new Date(Date.now() + 86400000);
  dateInput.min = tomorrow.toISOString().slice(0, 10);

  // créneaux fixes — la disponibilité est confirmée par l'équipe
  slotsWrap.innerHTML = "";
  BOOKING_SLOTS.forEach((slot) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "book-slot";
    btn.textContent = slot.label;
    btn.addEventListener("click", () => {
      slotsWrap.querySelectorAll(".book-slot").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedSlot = slot;
    });
    slotsWrap.appendChild(btn);
  });

  // liste de services à cocher
  BOOKING_SERVICES.forEach((svc) => {
    const row = document.createElement("label");
    row.className = "book-svc-row";
    row.innerHTML = `
      <span class="book-svc-check">
        <input type="checkbox" value="${svc.id}" data-name="${svc.name}" ${svc.required ? "checked disabled" : ""}>
        <span></span>
      </span>
      <span class="book-svc-name">${svc.name}${svc.required ? " <em>(inclus)</em>" : ""}</span>
    `;
    servicesWrap.appendChild(row);
  });

  function getSelectedServiceNames() {
    const names = BOOKING_SERVICES.filter((s) => s.required).map((s) => s.name);
    servicesWrap.querySelectorAll("input:checked:not(:disabled)").forEach((i) => {
      names.push(i.dataset.name);
    });
    return [...new Set(names)];
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "";
    if (!dateInput.value) {
      statusEl.textContent = "Choisissez une date.";
      return;
    }
    if (!selectedSlot) {
      statusEl.textContent = "Choisissez un créneau.";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Envoi en cours…";

    const formData = new FormData(form);
    const payload = {
      _subject: `Demande de réservation — ${dateInput.value} (${formData.get("event_type") || "événement"})`,
      _template: "table",
      _captcha: "false",
      "Date de l'événement": dateInput.value,
      "Créneau": selectedSlot.label,
      "Nom": formData.get("name"),
      "Courriel": formData.get("email"),
      "Téléphone": formData.get("phone") || "—",
      "Nombre d'invités": formData.get("guests") || "—",
      "Type d'événement": formData.get("event_type") || "—",
      "Services souhaités": getSelectedServiceNames().join(", "),
    };

    try {
      const res = await fetch(`https://formsubmit.co/ajax/${BOOKING_EMAIL}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && (data.success === "true" || data.success === true)) {
        form.reset();
        selectedSlot = null;
        slotsWrap.querySelectorAll(".book-slot").forEach((b) => b.classList.remove("active"));
        statusEl.textContent = "Merci ! Votre demande est envoyée — notre équipe vous confirme la disponibilité sous peu.";
        submitBtn.textContent = "Demande envoyée ✓";
      } else {
        statusEl.textContent = data.message || "Une erreur est survenue. Réessayez ou écrivez-nous directement.";
        submitBtn.disabled = false;
        submitBtn.textContent = "Vérifier ma date";
      }
    } catch (err) {
      statusEl.textContent = "Une erreur est survenue. Réessayez ou écrivez-nous directement.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Vérifier ma date";
    }
  });
})();
