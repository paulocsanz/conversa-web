// Semeia pt-br como idioma padrão antes do bundle do Element bootar.
// O valor exato aceito pelo manifesto de locales do app é "pt-br"
// (minúsculo com hífen — "pt_BR"/"pt-BR" não casam e caem no fallback "en").
// Faz o detector de locale ler pt-BR também (para telas que detectam o browser).
// Não sobrescreve a escolha de quem já trocou o idioma manualmente.
try {
  Object.defineProperty(navigator, "language", { get: () => "pt-BR", configurable: true });
  Object.defineProperty(navigator, "languages", { get: () => ["pt-BR", "pt"], configurable: true });
} catch (e) {}
try {
  var s = {};
  try { s = JSON.parse(localStorage.getItem("mx_local_settings") || "{}"); } catch (e) {}
  var errado = !s.language || s.language === "en" || s.language === "pt_BR" || s.language === "pt-BR";
  if (errado) {
    s.language = "pt-br";
    localStorage.setItem("mx_local_settings", JSON.stringify(s));
  }
} catch (e) {}
