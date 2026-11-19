// painel.js v3 — Descoberta estruturada: abas por contexto, filtros por categoria e região
// a sessão é a do Element (LS + IDB) — o painel só lê
const BASE_PADRAO = "https://tuwunel-production-642475dc.up.railway.app";
let BASE = BASE_PADRAO, accessToken = null;
let comunidades = [], marketplaces = [], eventos = [], minhasSalas = new Set();
let aba = "comunidades", filtroCat = null, filtroBairro = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CATCOR = { cultura: "#96412b", feira: "#755812", verde: "#3b6436", esporte: "#355680", "educação": "#635849", rede: "#8a5a2b", "arte": "#5a3b8a", "ajuda mútua": "#3b6436" };

async function lerSessao() {
  const ct = localStorage.getItem("conv_token"), cu = localStorage.getItem("conv_uid"), ch = localStorage.getItem("conv_hs");
  if (ct && cu && ch) return { hs: ch, uid: cu, tok: ct };
  let hs = localStorage.getItem("mx_hs_url"), uid = localStorage.getItem("mx_user_id"), tok = localStorage.getItem("mx_access_token");
  if (tok && uid && hs) return { hs, uid, tok };
  const db = await new Promise((res) => {
    const r = indexedDB.open("matrix-react-sdk");
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
  if (!db || ![...db.objectStoreNames].includes("account")) { if (db) db.close(); return null; }
  const tx = db.transaction("account", "readonly");
  const get = (k) => new Promise((res2) => {
    const rq = tx.objectStore("account").get(k);
    rq.onsuccess = () => res2(rq.result);
    rq.onerror = () => res2(null);
  });
  tok = await get("mx_access_token"); uid = await get("mx_user_id"); hs = await get("mx_hs_url");
  db.close();
  const plano = (v) => typeof v === "string" ? v : (v && typeof v === "object" ? (v.value ?? v.token ?? null) : null);
  tok = plano(tok); uid = plano(uid); hs = plano(hs);
  return (tok && uid && hs) ? { hs, uid, tok } : null;
}

const api = async (path, opts = {}) => {
  const r = await fetch(BASE + path, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
};

// ── trilha fixa ──
function criarTrilha() {
  if (document.getElementById("convTrilha")) return;
  const rail = document.createElement("div");
  rail.id = "convTrilha";
  rail.style.cssText = "position:fixed;left:0;top:0;bottom:0;width:248px;z-index:7000;background:#f8f4ec;border-right:1px solid #dcd3c2;color:#352d24;font-family:system-ui,-apple-system,sans-serif;overflow-y:auto";
  rail.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:14px 14px 10px">
      <img src="/icons/conversa.svg" style="width:26px;height:26px" alt="">
      <b style="font-size:1rem">Conversa</b>
    </div>
    <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.8px;color:#635849;padding:12px 14px 4px;opacity:.75">Minhas comunidades</div>
    <div id="convRailComunidades"><div style="padding:6px 14px;color:#635849;font-size:0.82rem">…</div></div>
    <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.8px;color:#635849;padding:14px 14px 4px;opacity:.75">Navegar</div>
    <div style="padding:0 8px">
      <button id="convBtnDescobrir" style="width:100%;background:rgb(150 65 43 / .06);color:#96412b;border:1px dashed #b09a7e;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer;text-align:left">🔎 descobrir por categoria, região e contexto</button>
    </div>
    <div style="padding:10px 14px;font-size:0.75rem;color:#635849">A sessão é a do chat — o painel só acompanha.</div>`;
  document.body.appendChild(rail);
  rail.querySelector("#convBtnDescobrir").onclick = abrirDescoberta;
  const st = document.createElement("style");
  st.textContent = "#matrixchat > div, .mx_MatrixChat_wrapper, body > div#matrixchat { margin-left:248px !important; } @media (max-width: 900px) { #convTrilha { display:none } }";
  document.head.appendChild(st);
}

// ── descoberta estruturada ──
let painelDesc = null;
function abrirDescoberta() {
  if (painelDesc && painelDesc.style.display !== "none") { painelDesc.style.display = "none"; return; }
  if (!painelDesc) {
    painelDesc = document.createElement("div");
    painelDesc.id = "convDescoberta";
    painelDesc.style.cssText = "position:fixed;right:0;top:0;bottom:0;width:480px;z-index:7500;background:#f2ece1;color:#352d24;font-family:system-ui,-apple-system,sans-serif;overflow-y:auto;border-left:1px solid #dcd3c2;padding:16px";
    document.body.appendChild(painelDesc);
  }
  painelDesc.style.display = "block";
  carregarDescoberta();
}
window.fecharDescoberta = () => { const p = document.getElementById("convDescoberta"); if (p) p.style.display = "none"; };

async function carregarDescoberta() {
  const sess = await lerSessao();
  if (!sess) {
    painelDesc.innerHTML = `<b>Entre no chat primeiro</b><p style="color:#635849;font-size:0.85rem">O login é no chat (aba Conversas). Aqui ativa sozinho depois.</p>`;
    return;
  }
  BASE = sess.hs; accessToken = sess.tok;
  try { const j = await api("/_matrix/client/v3/joined_rooms", {}); minhasSalas = new Set(j.joined_rooms || []); } catch (e) {}
  const d = await api("/_matrix/client/v3/publicRooms", { method: "POST", body: JSON.stringify({ limit: 100 }) });
  const chunk = d.chunk || [];
  comunidades = []; marketplaces = []; eventos = [];
  for (const r of chunk) {
    const topic = r.topic || "";
    const m = topic.match(/bairro:([^·]+) · cat:([^·]+) · ?(.*)/);
    if (r.room_type === "m.space") {
      comunidades.push({ room_id: r.room_id, nome: r.name, membros: r.num_joined_members,
        bairro: m ? m[1].trim() : "?", cat: m ? m[2].trim() : "?", desc: m ? m[3].trim() : "",
        souMembro: minhasSalas.has(r.room_id) });
    } else if (r.name && r.name.startsWith("marketplace — ")) {
      marketplaces.push({ room_id: r.room_id, nome: r.name.replace("marketplace — ", ""), membros: r.num_joined_members,
        bairro: m ? (m[1]||"").trim() : "?", souMembro: minhasSalas.has(r.room_id) });
    } else if (topic.startsWith("evento · quando:")) {
      const em = topic.match(/evento · quando:([^·]+) · local:([^·]+) · ?(.*)/);
      eventos.push({ room_id: r.room_id, titulo: em ? em[3].trim() : r.name, quando: em ? em[1].trim() : "?",
        local: em ? em[2].trim() : "?", membros: r.num_joined_members, souMembro: minhasSalas.has(r.room_id) });
    }
  }
  render();
}

function chipsCategoria() {
  const cats = [...new Set(comunidades.map(c => c.cat))];
  return cats.map(cat => `<button class="chip-f ${filtroCat === cat ? "ativa" : ""}" data-cat="${cat}" onclick="setCat('${cat}')">${cat}</button>`).join("");
}
window.setCat = (cat) => { filtroCat = filtroCat === cat ? null : cat; render(); };

function render() {
  const bairros = [...new Set(comunidades.map(c => c.bairro))].sort();
  const contagem = { comunidades: comunidades.length, marketplace: marketplaces.length, eventos: eventos.length };
  const abaBtn = (id, label) => `<button class="abaF ${aba === id ? "ativa" : ""}" onclick="setAba('${id}')">${label}</button>`;
  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <b style="font-size:1.05rem">Descobrir</b>
      <button onclick="fecharDescoberta()" style="background:none;border:0;color:#635849;cursor:pointer;font-size:1rem">fechar</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:12px">
      ${abaBtn("comunidades", "Comunidades")}
      ${abaBtn("marketplace", "Marketplace")}
      ${abaBtn("eventos", "Eventos")}
    </div>`;
  if (aba === "comunidades") {
    const cats = [...new Set(comunidades.map(c => c.cat))];
    html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <span style="font-size:0.75rem;color:#635849;align-self:center">tipo:</span>
      ${cats.map(cat => `<button class="chip-f ${filtroCat === cat ? "ativa" : ""}" onclick="setCat('${esc(cat)}')">${esc(cat)}</button>`).join("")}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      <span style="font-size:0.75rem;color:#635849;align-self:center">região:</span>
      ${bairros.map(b => `<button class="chip-f ${filtroBairro === b ? "ativa" : ""}" onclick="setBairro('${esc(b)}')">${esc(b)}</button>`).join("")}
    </div>`;
    const lista = comunidades
      .filter(c => !filtroCat || c.cat === filtroCat)
      .filter(c => !filtroBairro || c.bairro === filtroBairro);
    html += lista.map(c => cardComunidade(c)).join("") || `<p style="color:#635849">nada com esse filtro</p>`;
  } else if (aba === "marketplace") {
    html += marketplaces.length ? marketplaces.map(m => cardMarket(m)).join("") : `<p style="color:#635849">nenhum marketplace aberto ainda</p>`;
  } else {
    html += eventos.length ? eventos.map(e => cardEvento(e)).join("") : `<p style="color:#635849">nenhum evento marcado ainda</p>`;
  }
  painelDesc.innerHTML = html;
}
function cardComunidade(c) {
  const cor = CATCOR[c.cat] || "#635849";
  const acao = c.souMembro
    ? `<button style="background:#e9e1d2;color:#352d24;border:1px solid #dcd3c2;border-radius:8px;padding:4px 10px;cursor:pointer" onclick="irSala('${esc(c.room_id)}')">abrir</button>`
    : `<button style="background:#96412b;color:#fff8ef;border:0;border-radius:8px;padding:4px 10px;cursor:pointer" onclick="entrarEspaco('${esc(c.room_id)}')">participar</button>`;
  return `<div style="display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #dcd3c2;border-radius:14px;padding:10px;margin:8px 0">
    <div style="width:34px;height:34px;border-radius:10px;background:${cor};color:#fff8ef;display:flex;align-items:center;justify-content:center;font-weight:700">${esc(c.nome[0].toUpperCase())}</div>
    <div style="flex:1;min-width:0"><b style="font-size:0.92rem">${esc(c.nome)}</b>
      <div style="color:#635849;font-size:0.78rem">${esc(c.bairro)} · ${esc(c.desc).slice(0, 55)}</div></div>
    <span style="color:#635849;font-size:0.75rem">${c.membros}</span>
    ${acao}
  </div>`;
}
function cardMarket(m) {
  return `<div style="display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #dcd3c2;border-radius:14px;padding:10px;margin:8px 0">
    <div style="font-size:1.3rem">mercado</div>
    <div style="flex:1"><b style="font-size:0.92rem">${esc(m.nome)}</b>
      <div style="color:#635849;font-size:0.78rem">canal de compra e venda · ${m.membros} no canal</div></div>
    <button style="margin:0" onclick="irSala('${esc(m.room_id)}')">abrir</button>
  </div>`;
}
function cardEvento(e) {
  return `<div style="background:#fff;border:1px solid #dcd3c2;border-radius:14px;padding:10px;margin:8px 0">
    <b style="font-size:0.92rem">${esc(e.titulo)}</b>
    <div style="color:#635849;font-size:0.78rem">${esc(e.quando)} · ${esc(e.local)} · ${e.membros} confirmados</div>
    <button style="margin-top:6px" onclick="entrarEvento('${esc(e.room_id)}')">eu vou</button>
  </div>`;
}
window.setAba = (a) => { aba = a; render(); };
window.setBairro = (b) => { filtroBairro = filtroBairro === b ? null : b; render(); };

window.entrarEvento = async (roomId) => {
  try {
    await api(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`, { method: "POST", body: "{}" });
    await carregarDescoberta();
  } catch (e) { alert("não deu: " + e.message); }
};
window.entrarEspaco = async (roomId) => {
  try {
    await api(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`, { method: "POST", body: "{}" });
    const c = comunidades.find(x => x.room_id === roomId);
    if (c) { c.souMembro = true; c.membros += 1; }
    render();
  } catch (e) { alert("não deu: " + e.message); }
};
window.irSala = (roomId) => {
  fecharDescoberta();
  location.hash = "#/room/" + encodeURIComponent(roomId);
};
window.fecharDescoberta = () => { const p = document.getElementById("convDescoberta"); if (p) p.style.display = "none"; };

// estilos dos chips/filtros/abas
const st = document.createElement("style");
st.textContent = `
.chip-f { background:#fff;border:1px solid #dcd3c2;border-radius:999px;padding:3px 10px;font-size:0.75rem;color:#352d24;cursor:pointer;margin:2px 2px; }
.chip-f.ativa { background:#96412b;color:#fff8ef;border-color:#96412b; }
.abaF { background:#fff;border:1px solid #dcd3c2;border-radius:10px;padding:6px 10px;font-size:0.85rem;color:#352d24;cursor:pointer;flex:1; }
.abaF.ativa { background:#96412b;color:#fff8ef;border-color:#96412b; }
`;
document.head.appendChild(st);

// ── boot: espera a sessão do app e monta a trilha ──
(function boot() {
  const tent = setInterval(async () => {
    const sess = await lerSessao();
    if (sess) {
      clearInterval(tent);
      BASE = sess.hs; accessToken = sess.tok;
      criarTrilha();
      try {
        const j = await api("/_matrix/client/v3/joined_rooms", {});
        minhasSalas = new Set(j.joined_rooms || []);
      } catch (e) {}
      const railC = document.getElementById("convRailComunidades");
      if (railC) railC.innerHTML = `<div style="padding:6px 14px;color:#635849;font-size:0.82rem">abre o 🔎 descobrir pra navegar</div>`;
    }
  }, 2500);
})();
