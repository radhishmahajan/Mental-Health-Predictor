// ============================================================
// CONFIG
// ============================================================
// Point this at your running FastAPI server.
// If the frontend is served from the same origin as the API,
// you can simply use "/predict" instead.
const API_URL = "https://mental-health-predictor-s2dl.onrender.com/predict";

// ============================================================
// ELEMENT REFS
// ============================================================
const form = document.getElementById("predictForm");
const submitBtn = document.getElementById("submitBtn");
const errorBanner = document.getElementById("errorBanner");
const apiNote = document.getElementById("apiNote");

const resultCard = document.getElementById("resultCard");
const resultBand = document.getElementById("resultBand");
const resultBars = document.getElementById("resultBars");
const resetBtn = document.getElementById("resetBtn");

const dialArc = document.getElementById("dialArc");
const dialNeedle = document.getElementById("dialNeedle");
const dialValue = document.getElementById("dialValue");

const progressFill = document.getElementById("progressFill");
const progressPct = document.getElementById("progressPct");
const stepperItems = Array.from(document.querySelectorAll(".stepper__item"));
const sections = Array.from(document.querySelectorAll(".card[data-section]"));

// ============================================================
// FIELD DEFINITIONS
// ============================================================
const ALL_FIELD_NAMES = [
  "Age", "Gender", "Country", "Academic_Level",
  "Most_Used_Platform", "Purpose_Of_Use", "Avg_Daily_Usage_Hours", "Daily_Unlocks",
  "Study_Hours", "Physical_Activity_Hours", "Sleep_Hours_Per_Night", "Stress_Level",
];

const NUMERIC_FIELDS = new Set([
  "Age", "Avg_Daily_Usage_Hours", "Daily_Unlocks",
  "Study_Hours", "Physical_Activity_Hours", "Sleep_Hours_Per_Night",
]);
const INTEGER_FIELDS = new Set(["Age", "Daily_Unlocks"]);

const SECTION_FIELDS = {
  profile: ["Age", "Gender", "Country", "Academic_Level"],
  digital: ["Most_Used_Platform", "Purpose_Of_Use", "Avg_Daily_Usage_Hours", "Daily_Unlocks"],
  lifestyle: ["Study_Hours", "Physical_Activity_Hours", "Sleep_Hours_Per_Night", "Stress_Level"],
};

// ============================================================
// LIVE RADAR CHART
// ============================================================
const RADAR_CENTER = 120;
const RADAR_MAX_R = 84;
const RADAR_AXES = [
  { key: "Sleep_Hours_Per_Night", label: "SLEEP", max: 24 },
  { key: "Study_Hours", label: "STUDY", max: 24 },
  { key: "Physical_Activity_Hours", label: "ACTIVITY", max: 24 },
  { key: "Avg_Daily_Usage_Hours", label: "USAGE", max: 24 },
  { key: "Daily_Unlocks", label: "UNLOCKS", max: 1000 },
];

const radarGrid = document.getElementById("radarGrid");
const radarShape = document.getElementById("radarShape");
const radarDots = document.getElementById("radarDots");

function polarPoint(index, total, radius) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: RADAR_CENTER + radius * Math.cos(angle),
    y: RADAR_CENTER + radius * Math.sin(angle),
  };
}

function buildRadarGrid() {
  const svgNS = "http://www.w3.org/2000/svg";
  const rings = [0.25, 0.5, 0.75, 1];

  rings.forEach((frac) => {
    const points = RADAR_AXES.map((_, i) => {
      const p = polarPoint(i, RADAR_AXES.length, RADAR_MAX_R * frac);
      return `${p.x},${p.y}`;
    }).join(" ");
    const ring = document.createElementNS(svgNS, "polygon");
    ring.setAttribute("points", points);
    ring.setAttribute("class", "radar__ring");
    radarGrid.appendChild(ring);
  });

  RADAR_AXES.forEach((axis, i) => {
    const outer = polarPoint(i, RADAR_AXES.length, RADAR_MAX_R);
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", RADAR_CENTER);
    line.setAttribute("y1", RADAR_CENTER);
    line.setAttribute("x2", outer.x);
    line.setAttribute("y2", outer.y);
    line.setAttribute("class", "radar__axis");
    radarGrid.appendChild(line);

    const labelPoint = polarPoint(i, RADAR_AXES.length, RADAR_MAX_R + 16);
    const text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", labelPoint.x);
    text.setAttribute("y", labelPoint.y);
    text.setAttribute("class", "radar__axisLabel");
    text.setAttribute("dominant-baseline", "middle");
    text.textContent = axis.label;
    radarGrid.appendChild(text);

    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("r", "3.2");
    dot.setAttribute("class", "radar__dot");
    dot.setAttribute("id", `radarDot-${i}`);
    dot.setAttribute("cx", RADAR_CENTER);
    dot.setAttribute("cy", RADAR_CENTER);
    radarDots.appendChild(dot);
  });
}

const STRESS_COLORS = {
  Low: "#6FAE8B",
  Medium: "#C9A15A",
  High: "#B0564F",
};

function updateRadar() {
  const formData = new FormData(form);
  const points = RADAR_AXES.map((axis, i) => {
    const raw = parseFloat(formData.get(axis.key));
    const fraction = isNaN(raw) ? 0 : Math.min(1, Math.max(0, raw / axis.max));
    const p = polarPoint(i, RADAR_AXES.length, RADAR_MAX_R * fraction);
    const dot = document.getElementById(`radarDot-${i}`);
    if (dot) { dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y); }
    return `${p.x},${p.y}`;
  });
  radarShape.setAttribute("points", points.join(" "));

  const stress = formData.get("Stress_Level");
  const color = STRESS_COLORS[stress] || "#C9A15A";
  radarShape.style.stroke = color;
  radarShape.style.fill = hexToRgba(color, 0.22);
  document.querySelectorAll(".radar__dot").forEach((d) => (d.style.fill = color));
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ============================================================
// FLOATING LABELS + PROGRESS + STEPPER
// ============================================================
function syncFilledState(el) {
  const field = el.closest(".field--float");
  if (!field) return;
  field.classList.toggle("is-filled", String(el.value).trim() !== "");
}

function computeCompletion() {
  const formData = new FormData(form);
  let filled = 0;
  ALL_FIELD_NAMES.forEach((name) => {
    const val = formData.get(name);
    if (val !== null && String(val).trim() !== "") filled++;
  });
  return Math.round((filled / ALL_FIELD_NAMES.length) * 100);
}

function updateProgress() {
  const pct = computeCompletion();
  progressFill.style.width = `${pct}%`;
  progressPct.textContent = pct;

  const formData = new FormData(form);
  Object.entries(SECTION_FIELDS).forEach(([section, fields]) => {
    const complete = fields.every((f) => {
      const v = formData.get(f);
      return v !== null && String(v).trim() !== "";
    });
    const item = stepperItems.find((it) => it.dataset.target === section);
    if (item) item.classList.toggle("is-complete", complete);
  });
}

function setActiveSection(sectionName) {
  stepperItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.target === sectionName);
  });
}

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActiveSection(entry.target.dataset.section);
    });
  },
  { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
);
sections.forEach((s) => sectionObserver.observe(s));

form.addEventListener("input", (e) => {
  syncFilledState(e.target);
  updateProgress();
  updateRadar();
});
form.addEventListener("change", (e) => {
  updateProgress();
  updateRadar();
});

// ============================================================
// DIAL GEOMETRY (result score gauge)
// ============================================================
const DIAL_RADIUS = 98;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;
const dialArcEl = dialArc;

const GAUGE_MIN = 0;
const GAUGE_MAX = 10;

function setDial(value) {
  const clamped = Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, value));
  const fraction = (clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN);
  const arcLength = fraction * DIAL_CIRCUMFERENCE;

  dialArcEl.setAttribute("stroke-dasharray", `${arcLength} ${DIAL_CIRCUMFERENCE}`);
  dialArcEl.style.stroke = colorForScore(clamped);

  const angle = fraction * 360;
  dialNeedle.style.transform = `rotate(${angle}deg)`;
  dialValue.textContent = value.toFixed(1);
}

function colorForScore(score) {
  if (score <= 3.3) return "#B0564F";
  if (score <= 6.6) return "#C9A15A";
  return "#7FC7A7";
}

function bandForScore(score) {
  if (score <= 3.3) return { label: "Needs attention", bg: "#B0564F" };
  if (score <= 6.6) return { label: "Moderate", bg: "#C9A15A" };
  return { label: "Thriving", bg: "#7FC7A7" };
}

// ============================================================
// FORM → PAYLOAD
// ============================================================
function buildPayload(formData) {
  const payload = {};
  for (const [key, rawValue] of formData.entries()) {
    if (NUMERIC_FIELDS.has(key)) {
      payload[key] = INTEGER_FIELDS.has(key) ? parseInt(rawValue, 10) : parseFloat(rawValue);
    } else {
      payload[key] = rawValue;
    }
  }
  return payload;
}

// ============================================================
// VALIDATION HELPERS
// ============================================================
function clearFieldErrors() {
  document.querySelectorAll(".field").forEach((f) => f.classList.remove("has-error"));
  document.querySelectorAll(".field__error").forEach((e) => (e.textContent = ""));
}
function showFieldError(fieldName, message) {
  const errorEl = document.querySelector(`[data-error-for="${fieldName}"]`);
  if (!errorEl) return;
  errorEl.textContent = message;
  const field = errorEl.closest(".field");
  if (field) field.classList.add("has-error");
}
function showBanner(message) { errorBanner.textContent = message; errorBanner.hidden = false; }
function hideBanner() { errorBanner.hidden = true; errorBanner.textContent = ""; }

function validateClientSide(payload) {
  const missing = [];
  if (!payload.Stress_Level) missing.push("Stress_Level");
  return missing;
}

// ============================================================
// SUBMIT HANDLER
// ============================================================
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideBanner();
  clearFieldErrors();
  resultCard.hidden = true;

  const formData = new FormData(form);
  const payload = buildPayload(formData);

  const missing = validateClientSide(payload);
  if (missing.length) {
    missing.forEach((field) => showFieldError(field, "Please select an option."));
    showBanner("Please fill in every field before submitting.");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 422) {
      const errorData = await response.json();
      handleValidationErrors(errorData);
      showBanner("Some fields need a second look — see the notes above.");
      return;
    }

    if (!response.ok) {
      let detail = `Request failed with status ${response.status}.`;
      try {
        const errorData = await response.json();
        if (typeof errorData.detail === "string") detail = errorData.detail;
      } catch (_) { /* body wasn't JSON */ }
      showBanner(detail);
      return;
    }

    const data = await response.json();
    renderResult(data.predicted_mental_health_score, payload);
  } catch (err) {
    showBanner(
      "Couldn't reach the prediction server. Confirm it's running and that API_URL in script.js points to it, then try again."
    );
  } finally {
    setLoading(false);
  }
});

function handleValidationErrors(errorData) {
  if (!errorData || !Array.isArray(errorData.detail)) return;
  errorData.detail.forEach((err) => {
    const field = err.loc?.[err.loc.length - 1];
    if (field) showFieldError(field, err.msg || "Invalid value.");
  });
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("is-loading", isLoading);
  apiNote.textContent = isLoading ? "Talking to the model…" : "";
}

// ============================================================
// RESULT RENDERING
// ============================================================
const BAR_COLORS = ["#C9A15A", "#6FAE8B", "#7FC7A7", "#B0564F", "#E9D9B4"];

function renderResult(score, payload) {
  const numericScore = Number(score);
  const band = bandForScore(Math.min(10, Math.max(0, numericScore)));

  resultBand.textContent = `${band.label} · ${numericScore.toFixed(2)}`;
  resultBand.style.background = band.bg;

  setDial(numericScore);
  renderBars(payload);

  resultCard.hidden = false;
  resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderBars(payload) {
  resultBars.innerHTML = "";
  RADAR_AXES.forEach((axis, i) => {
    const value = payload[axis.key];
    const fraction = Math.min(1, Math.max(0, value / axis.max));
    const row = document.createElement("div");
    row.className = "bar__row";
    row.innerHTML = `
      <span class="bar__label">${axis.label.charAt(0)}${axis.label.slice(1).toLowerCase()}</span>
      <span class="bar__track"><span class="bar__fill" style="background:${BAR_COLORS[i]}"></span></span>
      <span class="bar__val">${formatAxisValue(axis.key, value)}</span>
    `;
    resultBars.appendChild(row);
    requestAnimationFrame(() => {
      row.querySelector(".bar__fill").style.width = `${fraction * 100}%`;
    });
  });
}

function formatAxisValue(key, value) {
  if (key === "Daily_Unlocks") return `${value}×`;
  return `${Number(value).toFixed(1)}h`;
}

// ============================================================
// RESET
// ============================================================
resetBtn.addEventListener("click", () => {
  resultCard.hidden = true;
  form.reset();
  clearFieldErrors();
  hideBanner();
  document.querySelectorAll(".field--float").forEach((f) => f.classList.remove("is-filled"));
  updateProgress();
  updateRadar();
  setDial(0);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ============================================================
// INIT
// ============================================================
buildRadarGrid();
updateRadar();
updateProgress();
setDial(0);