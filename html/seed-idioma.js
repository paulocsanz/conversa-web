// Semeia pt_BR como idioma padrão antes do bundle do Element bootar.
// O Element guarda as settings locais no localStorage "mx_local_settings";
// sem seed, ele segue o locale do browser (e cai em "English").
// Não sobrescreve a escolha de quem já trocou o idioma manualmente.
try {
  var s = {};
  try { s = JSON.parse(localStorage.getItem("mx_local_settings") || "{}"); } catch (e) {}
  if (!s.language) {
    s.language = "pt_BR";
    localStorage.setItem("mx_local_settings", JSON.stringify(s));
  }
} catch (e) {}
