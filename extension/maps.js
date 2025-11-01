// maps.js – constrói a URL do Google Maps com filtros simples
const QB_DEFAULTS = {
  openNow: true,
  minRating: 4.3,          // 0 a 5
  maxDistanceKm: 3,        // só para texto; Maps não tem param oficial, então vira "perto"
  price: "$$"              // "$" | "$$" | "$$$" | ""
};

function qb_getLang() {
  return (navigator.language || "pt-BR").toLowerCase();
}

function qb_i18n(termPt, termEs, termEn) {
  const lang = qb_getLang();
  if (lang.startsWith("pt")) return termPt;
  if (lang.startsWith("es")) return termEs;
  return termEn;
}

// Monta uma query textual robusta para o Maps (usa termos, não APIs secretas)
function qb_buildQuery(prefs = {}) {
  const p = Object.assign({}, QB_DEFAULTS, prefs);

  const base = qb_i18n(
    "restaurantes perto de mim",
    "restaurantes cerca de mí",
    "restaurants near me"
  );

  const openNow = p.openNow
    ? qb_i18n("abertos agora", "abiertos ahora", "open now")
    : "";

  const rating = p.minRating >= 3.5
    ? qb_i18n(`nota ${p.minRating}+`, `nota ${p.minRating}+`, `${p.minRating}+ rating`)
    : "";

  const price = p.price === "$"  ? qb_i18n("barato", "barato", "cheap") :
                 p.price === "$$" ? qb_i18n("preço médio", "precio medio", "moderate price") :
                 p.price === "$$$"? qb_i18n("mais caro", "caro", "expensive") : "";

  // Filtros em texto aumentam a assertividade do Maps. Ordem ajuda os chips.
  const parts = [base, openNow, rating, price].filter(Boolean);
  return parts.join(" ");
}

// URL final
function qb_buildMapsUrl(prefs = {}) {
  const q = qb_buildQuery(prefs);
  // usar /maps/search garante UI do Maps com cards e filtros
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

// Lê prefs (storage.sync) – Promise
function qb_loadPrefs() {
  return new Promise(resolve => {
    chrome.storage?.sync?.get(QB_DEFAULTS, (res) => {
      resolve(Object.assign({}, QB_DEFAULTS, res || {}));
    });
  });
}

// Abre a aba com a URL calculada
async function qb_openMaps(extra = {}) {
  const prefs = await qb_loadPrefs();
  const url = qb_buildMapsUrl(Object.assign({}, prefs, extra));
  chrome.tabs.create({ url });
}
