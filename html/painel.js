// painel.js — Comunidades como camada DENTRO do próprio app (sem iframe)
// a sessão é a do Element (mesmo documento): localStorage + IndexedDB do app
const BASE_PADRAO = "https://tuwunel-production-642475dc.up.railway.app";
let BASE = BASE_PADRAO, accessToken = null, meuUserId = null;
let comunidades = [], carregado = false;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CATCOR = { cultura: "#96412b", feira: "#755812", verde: "#3b6436", esporte: "#355680", "educação": "#635849", rede: "#8a5a2b", "ajuda mútua": "#3b6436" };
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ── sessão: lê do documento do app (fonte única — o Element) ──
async function lerSessao() {
  // sessão própria do painel (conv_*) — sobrevive a qualquer limpeza do Element
  const ct = localStorage.getItem("conv_token"), cu = localStorage.getItem("conv_uid"), ch = localStorage.getItem("conv_hs");
  if (ct && cu && ch) return { hs: ch, uid: cu, tok: ct };
  if (!localStorage.getItem("mx_has_access_token") && ct && cu) return { hs: ch || BASE_PADRAO, uid: cu, tok: ct };
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

// ── overlay ──
function criarOverlay() {
  const o = document.createElement("div");
  o.id = "overlayComunidades";
  o.style.cssText = "position:fixed;inset:0;z-index:9000;background:#f2ece1;color:#352d24;font-family:system-ui,-apple-system,sans-serif;overflow-y:auto";
  o.innerHTML = `
  <div style="display:flex;align-items:center;gap:8px;padding:14px 18px;background:#f8f4ec;border-bottom:1px solid #dcd3c2;position:sticky;top:0">
    <img src="/icons/conversa.svg" style="width:26px;height:26px" alt="">
    <b style="font-size:1.05rem">Comunidades</b>
    <span style="flex:1"></span>
    <button id="ovFechar" style="background:#e9e1d2;color:#352d24;border:1px solid #dcd3c2">← voltar ao chat</button>
  </div>
  <div style="max-width:820px;margin-inline:auto;padding:20px 18px 60px">
    <div id="ovConteudo"><p style="color:#635849;font-size:0.9rem">carregando…</p></div>
  </div>`;
  document.body.appendChild(o);
  o.querySelector("#ovFechar").onclick = fechar;
  return o;
}
function fechar() { const o = document.getElementById("overlayComunidades"); if (o) o.style.display = "none"; location.hash = ""; }
window.abrirComunidades = async function () {
  let o = document.getElementById("overlayComunidades");
  if (!o) o = criarOverlay();
  o.style.display = "block";
  location.hash = "#/comunidades";
  const sess = await lerSessao();
  if (!sess) {
    $("ovConteudo").innerHTML = `<div style="background:#fff;border:1px solid #dcd3c2;border-radius:16px;padding:18px;margin-top:20px">
      <b>Entre primeiro no chat</b>
      <p style="color:#635849;font-size:0.9rem">Feche esta camada (← voltar ao chat), faça login no formulário do app e volte aqui.</p></div>`;
    return;
  }
  BASE = sess.hs; accessToken = sess.tok; meuUserId = sess.uid;
  if (!carregado) await carregar();
  else await atualizar();
};
const $ = (id) => document.getElementById(id);

let minhasSalas = new Set(), parceirosDM = new Set();
async function carregar() {
  $("ovConteudo").innerHTML = `
    <div class="banner-rec" style="background:rgb(117 88 18 / 0.08);border:1px solid rgb(117 88 18 / 0.35);border-radius:14px;padding:12px 14px;margin:10px 0;display:flex;gap:10px">
      <div>🔐 <b>Proteja suas conversas</b> — configure a recuperação (1 min) para não perder nada se trocar de aparelho.
      <a href="#" onclick="event.preventDefault();fechar();location.hash='#/user/settings/security'">Configurar agora →</a></div>
    </div>
    <h2 style="font-size:1.05rem;margin:18px 0 8px">O que está acontecendo</h2>
    <div id="ovFeed">carregando…</div>
    <h2 style="font-size:1.05rem;margin:18px 0 8px">Comunidades</h2>
    <div id="ovLista">carregando…</div>
    <h2 style="font-size:1.05rem;margin:18px 0 8px">Criar comunidade</h2>
    <div style="background:#fff;border:1px solid #dcd3c2;border-radius:16px;padding:14px">
      <label style="font-size:0.8rem;color:#635849">Nome</label>
      <input id="ovNome" placeholder="ex: Cinema na laje" style="width:100%;padding:8px;border:1px solid #dcd3c2;border-radius:10px;margin:4px 0">
      <label style="font-size:0.8rem;color:#635849">O que rola (uma linha)</label>
      <input id="ovDesc" placeholder="ex: sessão comentada toda última sexta" style="width:100%;padding:8px;border:1px solid #dcd3c2;border-radius:10px;margin:4px 0">
      <button onclick="criarDaqui()">Criar e publicar</button>
      <div id="ovCriarMsg"></div>
    </div>`;
  try {
    const sinc = await api(`/_matrix/client/v3/joined_rooms`, {});
    minhasSalas = new Set(sinc.joined_rooms || []);
  } catch (e) {}
  let chunk = [];
  try {
    const d = await api("/_matrix/client/v3/publicRooms", { method: "POST", body: JSON.stringify({ limit: 50 }) });
    chunk = (d.chunk || []).filter(r => r.room_type === "m.space");
  } catch (e) {}
  comunidades = chunk.map(r => {
    const m = (r.topic || "").match(/bairro:([^·]+) · cat:([^·]+) · ?(.*)/);
    return { room_id: r.room_id, nome: r.name, membros: r.num_joined_members,
             bairro: m ? m[1].trim() : "?", cat: m ? m[2].trim() : "?", desc: m ? m[3].trim() : "",
             souMembro: minhasSalas.has(r.room_id) };
  });
  await atualizar();
}
async function atualizar() {
  const linhas = comunidades.map(c => {
    const cor = CATCOR[c.cat] || "#635849";
    return `<div style="display:flex;gap:12px;align-items:center;background:#fff;border:1px solid #dcd3c2;border-radius:16px;padding:12px;margin:8px 0">
      <div style="width:38px;height:38px;border-radius:12px;background:${cor};color:#fff8ef;display:flex;align-items:center;justify-content:center;font-weight:700">${esc(c.nome[0].toUpperCase())}</div>
      <div style="flex:1"><b>${esc(c.nome)}</b> <span class="chip" style="background:#f2ece1;border:1px solid #dcd3c2;border-radius:999px;padding:1px 8px;font-size:0.75rem">${esc(c.bairro)}</span>
        <div style="color:#635849;font-size:0.85rem">${esc(c.desc)}</div></div>
      <span style="color:#635849;font-size:0.8rem">${c.membros} pessoas</span>
      ${c.souMembro ? `<button onclick="irSala('${esc(c.room_id)}')" style="background:#e9e1d2;color:#352d24;border:1px solid #dcd3c2">abrir →</button>`
                    : `<button onclick="entrarEspaco('${esc(c.room_id)}')">Participar</button>`}
    </div>`;
  }).join("");
  $("ovLista").innerHTML = linhas || `<p style="color:#635849">nenhuma comunidade publicada ainda</p>`;
  const ups = [];
  for (const c of comunidades) {
    try {
      const d = await api(`/_matrix/client/v3/rooms/${encodeURIComponent(c.room_id)}/messages?dir=b&limit=3`);
      for (const e of (d.chunk || [])) if (e.type === "m.room.message" && e.content?.body)
        ups.push({ ts: e.origin_server_ts, c, txt: e.content.body });
    } catch (e) {}
  }
  ups.sort((a, b) => b.ts - a.ts);
  $("ovFeed").innerHTML = ups.slice(0, 8).map(({ c, ts, txt }) => {
    const quando = new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `<div style="border-left:3px solid #dcd3c2;padding:4px 0 4px 10px;margin:6px 0;font-size:0.9rem"><b>${esc(c.nome)}</b> · ${quando}<br>${esc(txt)}</div>`;
  }).join("") || `<p style="color:#635849">sem atualizações ainda</p>`;
}
window.criarDaqui = async function () {
  const nome = $("ovNome").value.trim(), desc = $("ovDesc").value.trim();
  if (!nome) return;
  try {
    const r = await api("/_matrix/client/v3/createRoom", { method: "POST", body: JSON.stringify({
      preset: "public_chat", visibility: "public", name: nome, room_alias_name: "com-" + slug(nome),
      topic: `bairro:— · cat:rede · ${desc || "comunidade"}`,
      creation_content: { type: "m.space" },
      initial_state: [{ type: "m.room.history_visibility", content: { history_visibility: "world_readable" } }] }) });
    comunidades.push({ room_id: r.room_id, nome, membros: 1, bairro: "—", cat: "rede", desc: desc || "", souMembro: true });
    await atualizar();
    $("ovCriarMsg").innerHTML = `<span style="color:#3b6436">✓ publicada</span>`;
  } catch (e) { $("ovCriarMsg").innerHTML = `<span style="color:#923324">falhou: ${e.message}</span>`; }
};
window.irSala = function (roomId) {
  fechar();
  location.hash = "#/room/" + encodeURIComponent(roomId);
};
window.entrarEspaco = async function (roomId) {
  try {
    await api(`/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, { method: "POST", body: "{}" });
    const c = comunidades.find(x => x.room_id === roomId);
    if (c) { c.souMembro = true; c.membros += 1; }
    await atualizar();
  } catch (e) { alert("não deu: " + e.message); }
};

// botão flutuante: abre a camada em qualquer tela do app
const btn = document.createElement("button");
btn.textContent = "🏘️ Comunidades";
btn.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:8000;background:#f2ece1;border:1px solid #dcd3c2;border-radius:999px;padding:8px 16px;color:#352d24;font-weight:600;cursor:pointer;box-shadow:0 1px 3px rgb(53 45 36 / .15)";
btn.onclick = () => window.abrirComunidades();
document.body.appendChild(btn);
