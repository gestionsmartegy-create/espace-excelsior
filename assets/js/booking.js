// Module de réservation — capture la demande (date, créneau, type
// d'événement, services souhaités) et la transmet au backend.
// Le paiement d'acompte n'est PAS demandé à cette étape : l'équipe
// valide d'abord les détails avec le client, l'acompte (si requis)
// se règle dans un second temps. Voir supabase/README.md.

(function () {
  const root = document.getElementById("reservation");
  if (!root) return;

  const isConfigured = !SUPABASE_FUNCTIONS_URL.includes("YOUR-PROJECT-REF");

  const dateInput = root.querySelector("#book-date");
  const slotsWrap = root.querySelector("#book-slots");
  const servicesWrap = root.querySelector("#book-services");
  const form = root.querySelector("#book-form");
  const submitBtn = root.querySelector("#book-submit");
  const statusEl = root.querySelector("#book-status");

  let selectedSlot = null;

  // liste de services à cocher, sans prix affiché à cette étape
  BOOKING_SERVICES.forEach((svc) => {
    const row = document.createElement("label");
    row.className = "book-svc-row";
    row.innerHTML = `
      <span class="book-svc-check">
        <input type="checkbox" value="${svc.id}" ${svc.required ? "checked disabled" : ""}>
        <span></span>
      </span>
      <span class="book-svc-name">${svc.name}${svc.required ? " <em>(inclus)</em>" : ""}</span>
    `;
    servicesWrap.appendChild(row);
  });

  function getSelectedServiceIds() {
    return BOOKING_SERVICES.filter((svc) => svc.required).map((s) => s.id).concat(
      Array.from(servicesWrap.querySelectorAll("input:checked:not(:disabled)")).map((i) => i.value)
    );
  }

  if (!isConfigured) {
    slotsWrap.innerHTML = `<p class="book-note">Le calendrier en ligne arrive bientôt. En attendant, écrivez-nous pour vérifier une date.</p>`;
    dateInput.disabled = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Bientôt disponible";
    return;
  }

  dateInput.addEventListener("change", async () => {
    selectedSlot = null;
    slotsWrap.innerHTML = `<p class="book-note">Recherche des créneaux…</p>`;
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/check-availability?date=${dateInput.value}`);
      const data = await res.json();
      if (!data.slots || data.slots.length === 0) {
        slotsWrap.innerHTML = `<p class="book-note">Aucun créneau libre à cette date.</p>`;
        return;
      }
      slotsWrap.innerHTML = "";
      data.slots.forEach((slot) => {
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
    } catch (e) {
      slotsWrap.innerHTML = `<p class="book-note">Erreur de chargement. Réessayez.</p>`;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!dateInput.value || !selectedSlot) {
      statusEl.textContent = "Choisissez une date et un créneau.";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Envoi en cours…";

    const formData = new FormData(form);
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateInput.value,
          start_time: selectedSlot.start,
          end_time: selectedSlot.end,
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          guest_count: formData.get("guests"),
          event_type: formData.get("event_type"),
          service_ids: getSelectedServiceIds(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        form.reset();
        slotsWrap.innerHTML = `<p class="book-note">Choisissez une date pour voir les créneaux libres.</p>`;
        statusEl.textContent = "Merci ! Votre date est en attente de confirmation — notre équipe vous écrit sous peu.";
        submitBtn.textContent = "Demande envoyée";
      } else {
        statusEl.textContent = data.error || "Une erreur est survenue. Réessayez.";
        submitBtn.disabled = false;
        submitBtn.textContent = "Vérifier ma date";
      }
    } catch (e) {
      statusEl.textContent = "Une erreur est survenue. Réessayez.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Vérifier ma date";
    }
  });
})();
