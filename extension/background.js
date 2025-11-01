// background.js — Gemini (v1beta) + Places Nearby (v1)
(() => {
  const DEBUG = true;
  const dlog = (...a) => DEBUG && console.debug("[QB:BG]", ...a);

  // ----- GEMINI -----
  const API_VERSION = "v1beta";
  const MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-exp",
  ];

  function parseText(data) {
    const joined = (data?.candidates || [])
      .map(c => (c?.content?.parts || []).map(p => p?.text || "").join("\n"))
      .join("\n").trim();
    return joined || data?.output_text || data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  async function callGemini({ key, model, prompt }) {
    const modelPath = model.startsWith("models/") ? model : `models/${model}`;
    const url = `https://generativelanguage.googleapis.com/${API_VERSION}/${modelPath}:generateContent?key=${encodeURIComponent(key)}`;
    const body = { contents: [{ parts: [{ text: String(prompt || "") }] }] };

    const resp = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = {};
    try { data = await resp.json(); } catch {}
    return { resp, data };
  }

  // ----- PLACES (v1) -----
  async function placesNearby({ key, lat, lng, radiusMeters = 3000, max = 6 }) {
    const url = "https://places.googleapis.com/v1/places:searchNearby";
    const body = {
      // restaurantes, abertos agora, ranqueados por popularidade
      includedTypes: ["restaurant"],
      maxResultCount: Math.max(1, Math.min(max, 10)),
      openNow: true,
      rankPreference: "POPULARITY",
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters }
      }
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Goog-Api-Key": key,
        // pedimos apenas os campos que vamos usar (reduz payload)
        "X-Goog-FieldMask": "places.id,places.displayName.text,places.rating,places.priceLevel"
      },
      body: JSON.stringify(body),
    });
    let data = {};
    try { data = await resp.json(); } catch {}
    return { resp, data };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // ---------- IA (Gemini) ----------
    if (message?.type === "GEMINI_GENERATE") {
      (async () => {
        try {
          const { geminiApiKey } = await chrome.storage.sync.get({ geminiApiKey: "" });
          if (!geminiApiKey) { sendResponse({ ok:false, error:"MISSING_API_KEY" }); return; }

          const prompt = String(message.prompt || "");
          let last = null;
          for (const model of MODELS) {
            try {
              const { resp, data } = await callGemini({ key: geminiApiKey, model, prompt });
              dlog("gemini try", { model, status: resp.status });
              if (resp.status === 404) { last = { code:404, model, data }; continue; }
              if (!resp.ok) { sendResponse({ ok:false, error:`HTTP ${resp.status}`, model, data }); return; }
              const text = parseText(data);
              if (!text) { sendResponse({ ok:false, error:"EMPTY_TEXT", model, data }); return; }
              sendResponse({ ok:true, text, model, apiVersion: API_VERSION }); return;
            } catch (e) {
              last = { code:"EXCEPTION", model, message:String(e?.message || e) }; continue;
            }
          }
          sendResponse({ ok:false, error:"ALL_MODELS_FAILED", detail:last });
        } catch (e) {
          sendResponse({ ok:false, error:String(e?.message || e) });
        }
      })();
      return true; // async
    }

    // ---------- Places Nearby (reais, abertos) ----------
    if (message?.type === "PLACES_NEARBY") {
      (async () => {
        try {
          const { placesApiKey } = await chrome.storage.sync.get({ placesApiKey: "" });
          if (!placesApiKey) { sendResponse({ ok:false, error:"MISSING_PLACES_KEY" }); return; }

          const { lat, lng, radiusMeters, max } = message;
          if (typeof lat !== "number" || typeof lng !== "number") {
            sendResponse({ ok:false, error:"INVALID_COORDS" }); return;
          }
          const { resp, data } = await placesNearby({
            key: placesApiKey, lat, lng, radiusMeters, max
          });
          dlog("places status", resp.status);
          if (!resp.ok) { sendResponse({ ok:false, error:`HTTP ${resp.status}`, data }); return; }

          const places = (data?.places || []).map(p => ({
            id: p.id,
            name: p.displayName?.text || "Lugar",
            rating: typeof p.rating === "number" ? p.rating : null,
            priceLevel: p.priceLevel || null
          }));
          sendResponse({ ok:true, places });
        } catch (e) {
          sendResponse({ ok:false, error:String(e?.message || e) });
        }
      })();
      return true; // async
    }

    if (message?.testPing) { sendResponse({ ok:true, pong:true }); return false; }
    return false;
  });
})();
