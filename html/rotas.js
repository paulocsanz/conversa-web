// rotas reais: o endereço mostra o caminho bonito (/comunidades, /sala/…)
// e o app continua navegando por hash por dentro — sincronizado nos dois sentidos
const ORIGEM = "https://tuwunel-production-642475dc.up.railway.app";
let mapaSalas = null, sincronizando = false;

async function buscarMapa() {
  if (mapaSalas) return mapaSalas;
  try {
    const tok = localStorage.getItem("conv_token") || localStorage.getItem("mx_access_token");
    const d = await (await fetch(ORIGEM + "/_matrix/client/v3/publicRooms", {
      method: "POST", headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: JSON.stringify({ limit: 100 }),
    })).json();
    mapaSalas = {};
    for (const r of d.chunk || []) {
      const alias = r.canonical_alias || "";
      const slug = alias.replace(/^#[a-z]+-/, "").split(":")[0];
      if (slug) mapaSalas[slug] = r.room_id;
      mapaSalas[r.room_id] = r.room_id;
    }
  } catch (e) { mapaSalas = null; }
  return mapaSalas || {};
}

function caminhoBonito(hash) {
  const m = hash.match(/^#\/room\/([^?]+)/);
  if (m) {
    const rid = decodeURIComponent(m[1]);
    const mapa = mapaSalas || {};
    const slug = Object.keys(mapa).find(k => mapa[k] === rid && !k.startsWith("!"));
    return slug ? "/comunidades/" + slug : "/sala/" + rid;
  }
  if (hash.includes("home")) return "/";
  return null;
}

function hashDaCaminho(path) {
  const mapa = mapaSalas || {};
  if (path.startsWith("/comunidades/")) {
    const slug = path.split("/comunidades/")[1].replace(/\/$/, "");
    const rid = mapa[slug];
    return rid ? "#/room/" + encodeURIComponent(rid) : "#/home";
  }
  if (path.startsWith("/sala/")) {
    const rid = path.split("/sala/")[1];
    return rid ? "#/room/" + decodeURIComponent(rid) : "#/home";
  }
  return "#/home";
}

async function aplicarCaminho(path, push) {
  sincronizando = true;
  const mapa = await buscarMapa();
  const alvo = hashDaCaminho(path);
  if (location.hash !== alvo) location.hash = alvo;
  sincronizando = false;
  if (push) history.pushState(null, "", path);
  else history.replaceState(null, "", path);
}

window.addEventListener("hashchange", () => {
  if (sincronizando) return;
  const bonito = caminhoBonito(location.hash);
  if (bonito !== null && bonito !== location.pathname) history.replaceState(null, "", bonito);
});
window.addEventListener("popstate", () => {
  if (sincronizando) return;
  sincronizando = true;
  const alvo = hashDaCaminho(location.pathname);
  if (location.hash !== alvo) location.hash = alvo;
  setTimeout(() => { sincronizando = false; }, 0);
});

// boot: se o usuário abrir um caminho real direto (/comunidades/x, /sala/x), aplica
if (location.pathname !== "/" && location.pathname !== "/index.html") {
  aplicarCaminho(location.pathname, false);
}
