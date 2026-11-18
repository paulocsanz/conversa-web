// Semeia pt_BR como idioma padrão antes do bundle do Element bootar.
// 1) faz o detector de locale do app ler pt-BR (o Element força o locale
//    do browser em cima do localStorage a cada boot);
// 2) semeia language=pt_BR no mx_local_settings como segunda trava.
// Não sobrescreve a escolha de quem já trocou o idioma manualmente.
try {
  Object.defineProperty(navigator, "language", { get: () => "pt-BR", configurable: true });
  Object.defineProperty(navigator, "languages", { get: () => ["pt-BR", "pt"], configurable: true });
} catch (e) {}
try {
  var s = {};
  try { s = JSON.parse(localStorage.getItem("mx_local_settings") || "{}"); } catch (e) {}
  if (!s.language || s.language === "en") {
    s.language = "pt_BR";
    localStorage.setItem("mx_local_settings", JSON.stringify(s));
  }
} catch (e) {}
