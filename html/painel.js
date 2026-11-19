// painel.js v2 — trilha lateral de Comunidades INJETADA no app (mesmo documento)
// Discord-like: [trilha de comunidades][salas do elemento][chat]
// a sessao e a do Element (mesma origem): LS + IDB — nunca criamos nem injetamos
const BASE_PADRAO = "https://tuwunel-production-642475dc.up.railway.app";
let BASE = BASE_PADRAO, accessToken = null, meuUserId = null;
let comunidades = [], minhasSalas = new Set();

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CATCOR = { cultura: "#96412b", feira: "#755812", verde: "#3b6436", esporte: "#355680", "educacao": "#635849", rede: "#8a5a2b", "ajuda mutua": "#3b6436" };

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
    <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.8px;color:#635849;padding:14px 14px 4px;opacity:.75">Descobrir</div>
    <div style="padding:0 8px">
      <button id="convBtnDescobrir" style="width:100%;background:rgb(150 65 43 / .06);color:#96412b;border:1px dashed #b09a7e;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer;text-align:left">descobrir comunidades da rede</button>
    </div>`;
  document.body.appendChild(rail);
  rail.querySelector("#convBtnDescobrir").onclick = abrirDescoberta;
  const st = document.createElement("style");
  st.textContent = "#matrixchat > div, .mx_MatrixChat_wrapper, body > div#matrixchat { margin-left:248px !important; } @media (max-width: 900px) { #convTrilha { display:none } }";
  document.head.appendChild(st);
}

let painelDesc = null;
function abrirDescoberta() {
  if (painelDesc && painelDesc.style.display !== "none") { painelDesc.style.display = "none"; return; }
  if (!painelDesc) {
    painelDesc = document.createElement("div");
    painelDesc.id = "convDescoberta";
    painelDesc.style.cssText = "position:fixed;right:0;top:0;bottom:0;width:440px;z-index:7500;background:#f2ece1;color:#352d24;font-family:system-ui,-apple-system,sans-serif;overflow-y:auto;border-left:1px solid #dcd3c2;padding:18px 16px";
    document.body.appendChild(painelDesc);
  }
  painelDesc.style.display = "block";
  carregarDescoberta();
}

comunidades = [];
async function carregarDescoberta() {
  const sess = await lerSessao();
  if (!sess) {
    if (painelDesc) painelDesc.innerHTML = "<b>Entre no chat primeiro</b><p style=color:#635849;font-size:0.85rem>Feche este painel, faca login no formulario do app e volte aqui.</p>";
    return;
  }
  BASE = sess.hs; accessToken = sess.tok; meuUserId = sess.uid;
  try { const j = await api("/_matrix/client/v3/joined_rooms", {}); minhasSalas = new Set(j.joined_rooms || []); } catch (e) {}
  const d = await api("/_matrix/client/v3/publicRooms", { method: "POST", body: JSON.stringify({ limit: 50 }) });
  comunidades = (d.chunk || []).filter(r => r.room_type === "m.space").map(r => {
    const m = (r.topic || "").match(/bairro:([^·]+) · cat:([^·]+) · ?(.*)/);
    return { room_id: r.room_id, nome: r.name, membros: r.num_joined_members,
             bairro: m ? m[1].trim() : "?", cat: m ? m[2].trim() : "?", desc: m ? m[3].trim() : "",
             souMembro: minhasSalas.has(r.room_id) };
  });
  renderDescoberta();
}

async function renderDescoberta() {
  if (!painelDesc) return;
  const linhas = comunidades.map(c => {
    const cor = CATCOR[c.cat] || "#635849";
    return `<div style="display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #dcd3c2;border-radius:14px;padding:10px;margin:8px 0">
      <div style="width:34px;height:34px;border-radius:10px;background:${cor};color:#fff8ef;display:flex;align-items:center;justify-content:center;font-weight:700">${esc(c.nome[0].toUpperCase())}</div>
      <div style="flex:1;min-width:0"><b style="font-size:0.92rem">${esc(c.nome)}</b>
        <div style="color:#635849;font-size:0.78rem">${esc(c.bairro)} · ${esc(c.desc).slice(0, 60)}</div></div>
      <span style="color:#635849;font-size:0.75rem">${c.membros}</span>
      ${c.souMembro ? `<button onclick="irSala('${esc(c.room_id)}')" style="background:#e9e1d2;color:#352d24;border:1px solid #dcd3c2;border-radius:8px;padding:4px 10px;cursor:pointer">abrir</button>`
                    : `<button onclick="entrarEspaco('${esc(c.room_id)}')" style="background:#96412b;color:#fff8ef;border:0;border-radius:8px;padding:4px 10px;cursor:pointer">participar</button>`}
    </div>`;
  }).join("");
  painelDesc.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <b style="font-size:1.05rem">Comunidades da rede</b>
      <button onclick="fecharDescoberta()" style="background:none;border:0;color:#635849;cursor:pointer;font-size:1rem">fechar</button>
    </div>
    <div style="font-size:0.78rem;color:#635849;margin-bottom:6px">Clicar em abrir troca a sala do chat ao lado.</div>
    ${linhas || "<p style=color:#635849>nenhuma comunidade publicada ainda</p>"}`;
}
window.fecharDescoberta = () => { const p = document.getElementById("convDescoberta"); if (p) p.style.display = "none"; };

window.irSala = (roomId) => {
  fecharDescoberta();
  location.hash = "#/room/" + encodeURIComponent(roomId);
};
window.entrarEspaco = async (roomId) => {
  try {
    await api(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`, { method: "POST", body: "{}" });
    const c = comunidades.find(x => x.room_id === roomId);
    if (c) { c.souMembro = true; c.membros += 1; }
    await carregarDescoberta();
  } catch (e) { alert("nao deu: " + e.message); }
};

(function boot() {
  const tent = setInterval(async () => {
    const sess = await lerSessao();
    if (sess) {
      clearInterval(tent);
      BASE = sess.hs; accessToken = sess.tok; meuUserId = sess.uid;
      criarTrilha();
      const railC = document.getElementById("convRailComunidades");
      if (railC) railC.innerHTML = "<div style=padding:6px 14px;color:#635849>carregando comunidades…</div>";
      try {
        const j = await api("/_matrix/client/v3/joined_rooms", {});
        minhasSalas = new Set(j.joined_rooms || []);
        const d = await api("/_matrix/client/v3/publicRooms", { method: "POST", body: JSON.stringify({ limit: 50 }) });
        comunidades = (d.chunk || []).filter(r => r.room_type === "m.space").map(r => {
          const m = (r.topic || "").match(/bairro:([^·]+) · cat:([^·]+) · ?(.*)/);
          return { room_id: r.room_id, nome: r.name, membros: r.num_joined_members,
                   bairro: m ? m[1].trim() : "?", cat: m ? m[2].trim() : "?", desc: m ? m[3].trim() : "",
                   souMembro: minhasSalas.has(r.room_id) };
        });
      } catch (e) { console.warn(e); }
      renderRail();
    }
  }, 2000);
})();

function renderRail() {
  const railC = document.getElementById("convRailComunidades");
  if (!railC) return;
  railC.innerHTML = comunidades.map(c => {
    const cor = CATCOR[c.cat] || "#635849";
    return `<div class="item" onclick="irSala('${esc(c.room_id)}')" title="${esc(c.desc)}" style="display:flex;align-items:center;gap:10px;padding:6px 10px;margin:2px 8px;border-radius:10px;cursor:pointer">
      <div style="width:30px;height:30px;border-radius:9px;background:${cor};color:#fff8ef;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none">${esc(c.nome[0].toUpperCase())}</div>
      <div style="min-width:0"><b style="display:block;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.nome)}</b>
      <span style="font-size:0.7rem;color:#635849">${c.membros} pessoas</span></div>
    </div>`;
  }).join("") || "<div style=padding:6px 14px;color:#635849>—</div>";
}
