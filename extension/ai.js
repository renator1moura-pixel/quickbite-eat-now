// ai.js — usa Prompt API se existir; senão, devolve fallback simples.
export async function qbSuggestTips(ctx) {
  try {
    // checa suporte (varia por build/canal)
    const can = await (window.ai?.canCreateTextSession?.() ?? 'no');
    if (can !== 'readily' && can !== 'after-download') return fallback();

    const session = await window.ai.createTextSession?.({
      // opcional: poucas instruções
      systemPrompt:
        "Você sugere comidas perto do usuário em 3 bullets curtos. " +
        "Use até 40 caracteres por sugestão; português do Brasil."
    });
    if (!session) return fallback();

    const now = new Date();
    const hh = now.getHours();
    const hint = hh < 11 ? "café da manhã" : hh < 15 ? "almoço" : hh < 18 ? "lanche" : "jantar";

    const prompt =
      `Contexto: período do dia=${hint}. Preferências padrão: aberto agora, nota 4.3+, preço $$.
       Gere 3 sugestões curtinhas e variadas (ex.: 'PF barato até 2 km'). Sem numeração longa.`;

    const out = await session.prompt(prompt);
    const lines = out.split(/\n|•|-|·/).map(s => s.trim()).filter(Boolean).slice(0,3);
    return lines.length ? lines : fallback();
  } catch {
    return fallback();
  }
  function fallback() {
    return ["Aberto agora perto", "Nota 4.3+ até 3 km", "Preço $$ por perto"];
  }
}
