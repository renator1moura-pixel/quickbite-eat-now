// content.js — Ícone garfo/faca + tooltip com IA (leve)
(() => {
  if (window.__qbLoaded) return;
  window.__qbLoaded = true;

  // ===== Config =====
  const IA_STRICT = true;          // só mostra sugestões se vier da IA
  const IA_TIMEOUT_MS = 5000;      // tempo máximo de espera da IA

  let __qbHideTimer = null;

  const BTN_ID  = "quickbite-eatnow-btn";
  const SLOT_ID = "quickbite-eatnow-slot";
  const TIP_ID  = "quickbite-eatnow-tip";

  const labels = [
    "Pesquisar por voz","Busca por voz","Search by voice","Buscar por voz",
    "Google Lens","Lens","Pesquisar por imagem","Pesquisa por imagem","Search by image",
    "Teclado","Ativar teclado virtual","Keyboard","Virtual keyboard"
  ].map(s => s.toLowerCase());

  // ---------- estilos ----------
  const style = document.createElement("style");
  style.textContent = `
    #${CSS.escape(BTN_ID)}{
      display:inline-flex; align-items:center; justify-content:center;
      background:transparent; border:none; outline:0; padding:0 2px;
      margin-left:2px; cursor:pointer; line-height:1; vertical-align:middle;
      -webkit-tap-highlight-color: transparent; user-select:none;
    }
    #${CSS.escape(BTN_ID)} svg, #${CSS.escape(BTN_ID)} svg *{
      pointer-events:none !important;
    }
    #${CSS.escape(BTN_ID)}:hover svg { opacity:.86; transform: translateY(-0.5px) scale(1.04); transition: transform .12s ease }
    #${CSS.escape(BTN_ID)}:active svg { opacity:.72 }
    #${CSS.escape(BTN_ID)}:focus-visible { outline:2px solid rgba(26,115,232,.3); border-radius:8px }

    /* tooltip */
    #${CSS.escape(TIP_ID)}{
      position:fixed; z-index:2147483647; pointer-events:auto;
      background:#202124; color:#fff; font-size:12px; line-height:16px;
      border-radius:4px; padding:6px 8px; box-shadow:0 1px 2px rgba(0,0,0,.3);
      opacity:0; transform:scale(.98); transition:opacity .12s ease, transform .12s ease;
      white-space:nowrap; display:none; min-width:160px;
    }
    #${CSS.escape(TIP_ID)}.show{ opacity:1; transform:scale(1) }
    #${CSS.escape(TIP_ID)} .qb-arrow{
      position:absolute; width:8px; height:8px; background:#202124;
      transform:translateX(-50%) rotate(45deg); top:-4px; left:50%;
    }
    #${CSS.escape(TIP_ID)} .qb-head{ font-weight:600; display:flex; align-items:center; gap:8px; margin-bottom:4px }
    #${CSS.escape(TIP_ID)} .qb-badge{
      display:none; font-size:11px; padding:1px 6px; border-radius:999px;
      background:#8ab4f8; color:#0b1736; font-weight:700;
    }
    #${CSS.escape(TIP_ID)} .qb-spin{
      display:none; width:10px; height:10px; border-radius:999px; border:2px solid rgba(255,255,255,.3);
      border-top-color:#fff; animation:qb-spin .7s linear infinite;
    }
    @keyframes qb-spin { to { transform: rotate(360deg) } }
    #${CSS.escape(TIP_ID)} .qb-list{ margin:4px 0 0; padding:0; list-style:none }
    #${CSS.escape(TIP_ID)} .qb-item{
      padding:3px 4px; border-radius:3px; cursor:pointer; display:flex; gap:6px; align-items:center;
    }
    #${CSS.escape(TIP_ID)} .qb-item:hover{ background:#303134 }
    #${CSS.escape(TIP_ID)} .qb-dot{ width:6px; height:6px; border-radius:999px; background:#8ab4f8; flex:0 0 6px }
    @media (prefers-color-scheme: light){
      #${CSS.escape(TIP_ID)}{ background:#202124; color:#fff }
    }
  `;
  document.documentElement.appendChild(style);

  // ---------- utils de Maps / Query ----------
  function lang() { return (navigator.language || "pt-BR").toLowerCase(); }
  function i18n(pt, es, en){ const L = lang(); return L.startsWith("pt")?pt: L.startsWith("es")?es: en; }

  function buildQuery(opts={}){
    const base = i18n("restaurantes perto de mim","restaurantes cerca de mí","restaurants near me");
    const parts = [base];
    if (opts.openNow) parts.push(i18n("abertos agora","abiertos ahora","open now"));
    if (opts.minRating) parts.push(i18n(`nota ${opts.minRating}+`,`nota ${opts.minRating}+`,`${opts.minRating}+ rating`));
    if (opts.price === "$")  parts.push(i18n("barato","barato","cheap"));
    if (opts.price === "$$") parts.push(i18n("preço médio","precio medio","moderate price"));
    if (opts.price === "$$$")parts.push(i18n("mais caro","caro","expensive"));
    if (opts.cuisine) parts.push(opts.cuisine);
    return parts.filter(Boolean).join(" ");
  }

  // >>>>>>> ALTERADO: abre ficha do local com query/query_place_id quando houver
  function openMaps(opts = {}) {
    // 1) Se tiver placeId (no futuro via Places API), abre ficha do lugar
    if (opts.placeId) {
      const base = "https://www.google.com/maps/search/?api=1";
      const q = encodeURIComponent(opts.query || "");
      const pid = encodeURIComponent(opts.placeId);
      const url = `${base}&query=${q}&query_place_id=${pid}&entry=ttu`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    // 2) Se tiver nome do local (query), abre direto a ficha pelo nome
    if (opts.query) {
      const url = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(opts.query);
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    // 3) Caso contrário, busca genérica por filtros
    const url = "https://www.google.com/maps/search/" + encodeURIComponent(buildQuery(opts));
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ---------- IA (via background -> Gemini) ----------
  async function aiSuggest(){
    setTipGenerating(true);
    setTipBadge(false);

    const now = new Date(), hh = now.getHours();
    const periodo = hh<11?"café da manhã": hh<15?"almoço": hh<18?"lanche":"jantar";
    const prompt =
      `Você sugere 3 ideias curtíssimas para comer por perto (máx 40 caracteres por linha).
       Contexto: período=${periodo}. Preferências: aberto agora, nota 4.3+, preço $$.
       Responda APENAS as 3 linhas, uma por linha.`;

    try{
      const ask = chrome.runtime.sendMessage({ type:"GEMINI_GENERATE", prompt });
      const timeout = new Promise(res => setTimeout(() => res({ timeout:true }), IA_TIMEOUT_MS));
      const res = await Promise.race([ask, timeout]);

      setTipGenerating(false);

      if (res && res.ok && res.text){
        const tips = String(res.text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,3);
        if (tips.length){
          setTipBadge(true);                 // selo IA
          return toItems(tips);
        }
      }

      if (IA_STRICT){ showIaError(); return []; }
      return fallback();
    } catch {
      setTipGenerating(false);
      if (IA_STRICT){ showIaError(); return []; }
      return fallback();
    }
  }

  function fallback(){
    return toItems([
      i18n("Aberto agora perto","Abiertos ahora cerca","Open now nearby"),
      i18n("Nota 4.5+ até 3 km","Nota 4.5+ hasta 3 km","4.5+ rating within 3 km"),
      i18n("Você visitou recentemente","Visitaste recientemente","You visited recently")
    ]);
  }

  function showIaError(){
    renderTipHead(i18n("Sugestões","Sugerencias","Suggestions"));
    const tip = ensureTip();
    const ul  = tip.querySelector(".qb-list");
    ul.innerHTML = "";

    const items = [
      { label: i18n("IA indisponível agora","IA no disponible","AI unavailable") },
      { label: i18n("Tentar novamente","Intentar de nuevo","Try again"), retry:true }
    ];

    items.forEach(it => {
      const li = document.createElement("li");
      li.className = "qb-item";
      li.innerHTML = `<span class="qb-dot"></span><span>${escapeHtml(it.label)}</span>`;
      if (it.retry){
        li.addEventListener("click", async (e)=>{
          e.stopPropagation();
          renderTipItems([]);          // limpa
          setTipGenerating(true);
          const again = await aiSuggest();
          if (again.length) renderTipItems(again);
        });
      }
      ul.appendChild(li);
    });
  }

  // >>>>>>> ALTERADO: mapeia sugestões para incluir o nome como query (remoção de "(4.5)")
  function toItems(texts){
    return texts.map(t => {
      const label = t.trim();
      const low = label.toLowerCase();
      const item = {
        label,
        // remove notas no final tipo " (4.5)" para melhorar a busca nominal
        opts: { query: label.replace(/\s*\(\d(?:\.\d)?\)\s*$/, "") }
      };

      if (low.includes("aberto")||low.includes("abierto")||low.includes("open")) item.opts.openNow = true;
      if (/\b4(\.|,)?5\+?\b/.test(low)) item.opts.minRating = 4.5;
      if (/\b4(\.|,)?3\+?\b/.test(low)) item.opts.minRating = 4.3;
      if (low.includes("$") && !low.includes("$$$")) item.opts.price = low.includes("$$") ? "$$" : "$";
      if (/(jap|sushi)/.test(low)) item.opts.cuisine = i18n("japonês","japonés","japanese");
      if (/(pizza)/.test(low)) item.opts.cuisine = "pizza";
      if (/(hamb|burger)/.test(low)) item.opts.cuisine = i18n("hambúrguer","hamburguesa","burger");

      // Futuro: se você anexar item.opts.placeId = "XXXX", abriremos via query_place_id
      return item;
    });
  }

  // ---------- tooltip ----------
  function ensureTip(){
    let tip = document.getElementById(TIP_ID);
    if (!tip) {
      tip = document.createElement("div");
      tip.id = TIP_ID;
      tip.innerHTML = `
        <div class="qb-arrow"></div>
        <span class="qb-head">
          ${i18n("Sugestões","Sugerencias","Suggestions")}
          <span class="qb-badge">IA</span>
          <span class="qb-spin"></span>
        </span>
        <ul class="qb-list"></ul>
      `;
      document.body.appendChild(tip);

      // hover robusto: cancela o timer quando entra
      tip.addEventListener("mouseenter", ()=>{ clearTimeout(__qbHideTimer); });
      tip.addEventListener("mouseleave", (e)=>{
        const btn = document.getElementById(BTN_ID);
        if (!btn) return;
        const overBtn = btn.contains(e.relatedTarget);
        if (!overBtn) hideTip();
      });
      tip.addEventListener("mousedown", e => e.preventDefault());
    }
    return tip;
  }
  function positionTip(tip, rect){
    const pad = 8, vw = window.innerWidth;
    tip.style.left = "0px"; tip.style.top = "-1000px";
    const width = tip.offsetWidth;
    let left = rect.left + rect.width/2 - width/2;
    if (left < pad) left = pad;
    if (left + width > vw - pad) left = vw - pad - width;
    const top = rect.bottom + 10;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top  = `${Math.round(top)}px`;
    const arrow = tip.querySelector(".qb-arrow");
    const centerX = rect.left + rect.width/2;
    const arrowLeft = Math.max(8, Math.min(width - 8, centerX - left));
    arrow.style.left = `${Math.round(arrowLeft)}px`;
  }
  function renderTipHead(text){
    const tip = ensureTip();
    tip.querySelector(".qb-head").childNodes[0].nodeValue = text || "Comer agora";
  }
  function setTipGenerating(flag){
    const tip = document.getElementById(TIP_ID);
    if (!tip) return;
    const head = tip.querySelector(".qb-head");
    const spin = tip.querySelector(".qb-spin");
    if (head && spin){ spin.style.display = flag ? "inline-block" : "none"; head.style.opacity = flag ? ".8" : "1"; }
  }
  function setTipBadge(flag){
    const tip = document.getElementById(TIP_ID);
    if (!tip) return;
    const badge = tip.querySelector(".qb-badge");
    if (badge) badge.style.display = flag ? "inline-block" : "none";
  }
  function renderTipItems(items){
    const tip = ensureTip();
    const ul = tip.querySelector(".qb-list");
    ul.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("li");
      li.className = "qb-item";
      li.innerHTML = `<span class="qb-dot"></span><span>${escapeHtml(it.label)}</span>`;
      li.addEventListener("click", (e)=>{ e.stopPropagation(); hideTip(); openMaps(it.opts||{}); });
      ul.appendChild(li);
    });
  }
  function showTip(target){
    const tip = ensureTip();
    tip.style.display = "block";
    positionTip(tip, target.getBoundingClientRect());
    requestAnimationFrame(() => tip.classList.add("show"));
  }
  function hideTip(){
    const tip = document.getElementById(TIP_ID);
    if (!tip) return;
    tip.classList.remove("show");
    setTimeout(() => { tip.style.display = "none"; }, 120);
  }
  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ---------- ação principal ----------
  function openMapsRestaurants() { openMaps({}); }

  function makeBtn() {
    let b = document.getElementById(BTN_ID);
    if (b) return b;
    b = document.createElement("button");
    b.id = BTN_ID;
    b.type = "button";
    b.setAttribute("aria-label","Comer agora");
    b.removeAttribute("title");

    b.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="color:currentColor">
        <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 3v7"/><path d="M4 3v5"/><path d="M8 3v5"/><path d="M5 10v11"/>
          <path d="M14 4c0 2-1.5 3-1.5 5S14 12 14 13v8"/><path d="M18 3v18"/>
        </g>
      </svg>
    `;

    let aiTimer = null;
    const tip = () => document.getElementById(TIP_ID);

    const onEnter = () => {
      renderTipHead(i18n("Comer agora","Comer ahora","Eat now"));
      renderTipItems([]); // limpa
      showTip(b);
      clearTimeout(aiTimer);
      aiTimer = setTimeout(async () => {
        const t = tip();
        if (!t || t.style.display !== "block") return;
        renderTipHead(i18n("Sugestões","Sugerencias","Suggestions"));
        const items = await aiSuggest();
        const t2 = tip();
        if (t2 && t2.style.display === "block") renderTipItems(items);
      }, 520);
    };

    const onLeave = (e) => {
      const t = tip();
      const overTip = t && t.contains(e.relatedTarget);
      clearTimeout(aiTimer);
      if (!overTip) {
        clearTimeout(__qbHideTimer);
        __qbHideTimer = setTimeout(() => hideTip(), 160); // delay evita “apagar” no caminho
      }
    };

    const onMove  = () => {
      const t = tip();
      if (t && t.style.display === "block") {
        positionTip(t, b.getBoundingClientRect());
      }
    };

    b.addEventListener("mouseenter", onEnter);
    b.addEventListener("mouseleave", onLeave);
    b.addEventListener("mousemove", onMove);
    b.addEventListener("focus", onEnter);
    b.addEventListener("blur", hideTip);
    b.addEventListener("click", openMapsRestaurants);
    return b;
  }

  const q  = sel => document.querySelector(sel);
  const qa = sel => Array.from(document.querySelectorAll(sel));

  function findIconAnchor() {
    const candidates = qa('button[aria-label],div[role="button"][aria-label]');
    for (const el of candidates) {
      const v = (el.getAttribute("aria-label") || "").toLowerCase();
      if (labels.some(lb => v.includes(lb))) return el;
    }
    return null;
  }

  function syncSizeWith(el, btn) {
    try {
      const cs = getComputedStyle(el);
      const w  = Math.round(parseFloat(cs.width)  || el.offsetWidth  || 40);
      const h  = Math.round(parseFloat(cs.height) || el.offsetHeight || 40);
      btn.style.width  = `${w}px`;
      btn.style.height = `${h}px`;
      const icon = btn.querySelector("svg");
      const side = Math.round(Math.min(w, h) * 0.53);
      icon.setAttribute("width",  `${side}`);
      icon.setAttribute("height", `${side}`);
    } catch (_) {}
  }

  function insertAfterIcon() {
    const anchor = findIconAnchor();
    if (!anchor) return false;
    const btn = makeBtn();
    const parent = anchor.parentElement || anchor.closest("div");
    if (!parent) return false;
    if (!document.getElementById(BTN_ID)) parent.insertBefore(btn, anchor.nextSibling);
    syncSizeWith(anchor, btn);
    return true;
  }

  function insertInCombobox() {
    const combo = q('form[action="/search"] div[role="combobox"]');
    if (!combo) return false;
    const cs = getComputedStyle(combo);
    if (cs.position === "static" || !cs.position) combo.style.position = "relative";
    let slot = combo.querySelector("#" + SLOT_ID);
    if (!slot) {
      slot = document.createElement("div");
      slot.id = SLOT_ID;
      slot.style.cssText = [
        "position:absolute","top:50%","right:8px","transform:translateY(-50%)",
        "display:inline-flex","z-index:10","pointer-events:auto"
      ].join(";");
      combo.appendChild(slot);
    }
    const btn = makeBtn();
    if (!document.getElementById(BTN_ID)) slot.appendChild(btn);
    btn.style.width = "40px"; btn.style.height = "40px";
    const icon = btn.querySelector("svg");
    icon.setAttribute("width","21"); icon.setAttribute("height","21");
    btn.style.transform = "translateY(-1px)";
    return true;
  }

  function tryInsert() {
    if (insertAfterIcon())   return true;
    if (insertInCombobox())  return true;
    return false;
  }

  // injeta
  let attempts = 0, inserted = false;
  const iv = setInterval(() => {
    if (q('form[action="/search"]')) {
      inserted = inserted || tryInsert();
      if (inserted) { clearInterval(iv); return; }
    }
    if (++attempts > 120) clearInterval(iv);
  }, 100);

  // reinserção + esconder tooltip em navegação/scroll/resize
  const mo = new MutationObserver(() => {
    if (!document.getElementById(BTN_ID)) tryInsert();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pagehide", () => mo.disconnect());
  window.addEventListener("scroll", hideTip, { passive:true });
  window.addEventListener("resize", hideTip);
})();
