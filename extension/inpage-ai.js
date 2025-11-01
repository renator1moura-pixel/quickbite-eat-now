// inpage-ai.js
(() => {
  const HAS_AI = () => "ai" in window;

  async function aiMakeQuery(intent, prefs) {
    try {
      if (!HAS_AI() || !window.ai?.languageModel) return null;
      const caps = await window.ai.languageModel.capabilities();
      if (caps.available === "no") return null;

      const session = await window.ai.languageModel.create({ temperature: 0.2 });
      const L = (navigator.language || "pt-BR").toLowerCase();
      const base = L.startsWith("pt") ? "restaurantes" : L.startsWith("es") ? "restaurantes" : "restaurants";

      const prompt = `
Gere APENAS uma consulta curta para Google Maps, no idioma do usuário, sem explicações.
Contexto: o usuário quer ${base} "${intent}" com preferências JSON: ${JSON.stringify(prefs || {})}.
Use termos/chips comuns do Maps (ex.: 'abertos agora', '4,7+', '$'/'$$', 'perto de mim').
Exemplo de saída: restaurantes abertos agora 4,7+ até 3 km comida brasileira $ perto de mim
`.trim();

      // Compatibilidade antiga/recente:
      const out = session.generateText
        ? (await session.generateText(prompt))?.output
        : await session.prompt(prompt);

      const txt = (out || "").trim().replace(/^"|"$/g, "");
      return txt || null;
    } catch (e) {
      return null;
    }
  }

  async function aiSummarize(items) {
    try {
      if (!HAS_AI() || !window.ai?.summarizer) return null;
      const caps = await window.ai.summarizer.capabilities?.();
      if (caps?.available === "no") return null;

      const s = await window.ai.summarizer.create();
      const text = items.map((r,i)=>`${i+1}. ${r.name} — nota ${r.rating||"?"}, preço ${r.price||"?"}, dist ${r.distance||"?"}`).join("\n");
      const res = await s.summarize(text, { type: "key-points" });
      return res?.summary || null;
    } catch(e) {
      return null;
    }
  }

  // Bridge com o content.js
  window.addEventListener("message", async (ev) => {
    const d = ev.data || {};
    if (!d || !d.qb || d.target !== "inpage-ai") return;

    if (d.type === "QB_AI_QUERY") {
      const query = await aiMakeQuery(d.intent, d.prefs);
      window.postMessage({ qb:true, source:"inpage-ai", type:"QB_AI_QUERY_RESULT", id:d.id, query }, "*");
    }

    if (d.type === "QB_AI_SUMMARIZE") {
      const summary = await aiSummarize(d.items || []);
      window.postMessage({ qb:true, source:"inpage-ai", type:"QB_AI_SUMMARY_RESULT", id:d.id, summary }, "*");
    }
  });
})();
