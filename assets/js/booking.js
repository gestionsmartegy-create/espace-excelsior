// Module de réservation — interroge les Edge Functions Supabase
// définies dans booking-config.js. Si SUPABASE_FUNCTIONS_URL n'est
// pas encore configuré, le module reste affiché mais désactivé
// avec un message clair, plutôt que d'échouer silencieusement.

(function () {
  const root = document.getElementById("reservation");
  if (!root) return;

  const isConfigured = !SUPABASE_FUNCTIONS_URL.includes("YOUR-PROJECT-REF");

  const dateInput = root.querySelector("#book-date");
  const slotsWrap = root.querySelector("#book-slots");
  const servicesWrap = root.querySelector("#book-services");
  const totalEl = root.querySelector("#book-total");
  const depositEl = root.querySelector("#book-deposit");
  const form = root.querySelector("#book-form");
  const submitBtn = root.querySelector("#book-submit");
  const statusEl = root.querySelector("#book-status");

  let selectedSlot = null;

  // construit la liste de services à cocher
  BOOKING_SERVICES.forEach((svc) => {
    const row = document.createElement("label");
    row.className = "book-svc-row";
    row.innerHTML = `
      <span class="book-svc-check">
        <input type="checkbox" value="${svc.id}" ${svc.required ? "checked disabled" : ""}>
        <span></span>
      </span>
      <span class="book-svc-name">${svc.name}${svc.required ? " <em>(inclus)</em>" : ""}</span>
      <span class="book-svc-price">${formatPrice(svc.price_cents)}</span>
    `;
    servicesWrap.appendChild(row);
  });

  servicesWrap.addEventListener("change", updateTotals);
  updateTotals();

  function getSelectedServiceIds() {
    return BOOKING_SERVICES.filter((svc) => svc.required).map((s) => s.id).concat(
      Array.from(servicesWrap.querySelectorAll("input:checked:not(:disabled)")).map((i) => i.value)
    );
  }

  function updateTotals() {
    const ids = new Set(getSelectedServiceIds());
    const selected = BOOKING_SERVICES.filter((s) => ids.has(s.id));
    const total = selected.reduce((sum, s) => sum + s.price_cents, 0);
    const deposit = Math.max(Math.round(total * DEPOSIT_PERCENT), DEPOSIT_MIN_CENTS);
    totalEl.textContent = formatPrice(total);
    depositEl.textContent = formatPrice(deposit);
  }

  function formatPrice(cents) {
    return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 });
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
    submitBtn.textContent = "Redirection vers le paiement…";

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
          service_ids: getSelectedServiceIds(),
        }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        statusEl.textContent = data.error || "Une erreur est survenue.";
        submitBtn.disabled = false;
        submitBtn.textContent = "Payer l'acompte et réserver";
      }
    } catch (e) {
      statusEl.textContent = "Une erreur est survenue. Réessayez.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Payer l'acompte et réserver";
    }
  });
})();
