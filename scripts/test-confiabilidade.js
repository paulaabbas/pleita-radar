/**
 * PLEITA RADAR — PORTÃO DE CONFIABILIDADE
 * ─────────────────────────────────────────
 * Roda APÓS a geração e ANTES da publicação.
 * Se qualquer teste CRÍTICO falhar → exit 1 → o commit não acontece
 * → a edição anterior permanece no ar (princípio: melhor desatualizado que errado).
 *
 * Testes:
 *  [CRÍTICO] Schema completo — todas as seções obrigatórias presentes
 *  [CRÍTICO] Whitelist — toda fonte citada está em config/fontes.json
 *  [CRÍTICO] Regra TSE — pesquisa eleitoral sem registro válido é reprovada
 *  [CRÍTICO] Aritmética — percentuais impossíveis (>100%, negativos)
 *  [AVISO]   Datas — datas futuras ou não parseáveis
 *  [AVISO]   URLs — links fora dos domínios da whitelist
 *  [CRÍTICO] Auditoria — bloco de auditoria presente (dupla passada aconteceu)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const REPORT_PATH = path.join(ROOT, "docs/dados/latest.json");
const FONTES = JSON.parse(fs.readFileSync(path.join(ROOT, "config/fontes.json"), "utf8"));

let criticos = 0, avisos = 0, passados = 0;
const log = [];

function critico(nome, ok, detalhe) {
  if (ok) { passados++; log.push(`  ✓ ${nome}`); }
  else { criticos++; log.push(`  ✗ CRÍTICO — ${nome}: ${detalhe}`); }
}
function aviso(nome, ok, detalhe) {
  if (ok) { passados++; log.push(`  ✓ ${nome}`); }
  else { avisos++; log.push(`  ⚠ AVISO — ${nome}: ${detalhe}`); }
}

/* ── Carregar relatório ─────────────────────────────── */
if (!fs.existsSync(REPORT_PATH)) {
  console.error("✗ CRÍTICO — docs/dados/latest.json não existe. A geração falhou antes de salvar.");
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));

console.log("═══ PORTÃO DE CONFIABILIDADE PLEITA ═══\n");

/* ── 1. Schema ──────────────────────────────────────── */
const secoesObrigatorias = ["resumo_executivo", "cenario_macro", "pesquisas_dados", "narrativas_por_perfil", "pulso_digital", "tendencias_setor", "linha_editorial", "insumos_pleita"];
secoesObrigatorias.forEach((s) =>
  critico(`Schema: seção "${s}"`, r[s] !== undefined && r[s] !== null, "seção ausente")
);
critico("Schema: cenario_macro tem ≥3 itens", (r.cenario_macro || []).length >= 3, `apenas ${(r.cenario_macro || []).length}`);
critico("Schema: narrativas para os 3 perfis", !!(r.narrativas_por_perfil?.situacao && r.narrativas_por_perfil?.oposicao && r.narrativas_por_perfil?.centro_independente), "perfil faltando");

/* ── 2. Whitelist de fontes ─────────────────────────── */
const nomesPermitidos = [
  ...FONTES.jornalismo.map((f) => f.nome.toLowerCase()),
  ...FONTES.institutos_pesquisa.map((f) => f.nome.toLowerCase()),
];
const dominiosPermitidos = [
  ...FONTES.jornalismo.map((f) => f.dominio),
  ...FONTES.institutos_pesquisa.map((f) => f.dominio),
];

function fonteNaWhitelist(fonte) {
  const f = (fonte || "").toLowerCase();
  return nomesPermitidos.some((n) => f.includes(n) || n.includes(f.split("/")[0].trim()));
}

(r.cenario_macro || []).forEach((item, i) => {
  critico(`Whitelist: item macro #${i + 1} ("${(item.fonte || "").slice(0, 30)}")`, fonteNaWhitelist(item.fonte), "fonte fora da whitelist — item deveria ter sido removido pelo auditor");
});

/* ── 3. Regra TSE ───────────────────────────────────── */
const padraoTSE = /^[A-Z]{2}-\d{4,6}\/20\d{2}$/;
const institutosEleitorais = FONTES.institutos_pesquisa.filter((f) => f.exige_registro_tse).map((f) => f.nome.toLowerCase());

(r.pesquisas_dados?.destaques || []).forEach((d, i) => {
  const inst = (d.instituto || "").toLowerCase();
  const ehEleitoral = institutosEleitorais.some((n) => inst.includes(n));
  const pareceEleitoral = /turno|intencao|intenção|voto|eleic|eleiç|aprovacao|aprovação/i.test((d.dado_principal || "") + (d.contexto || ""));
  if (ehEleitoral && pareceEleitoral) {
    const reg = (d.registro_tse || "").trim();
    critico(`TSE: pesquisa #${i + 1} (${d.instituto})`, padraoTSE.test(reg), `registro "${reg}" inválido ou ausente — pesquisa eleitoral não pode ser publicada`);
  } else {
    aviso(`TSE: pesquisa #${i + 1} (${d.instituto}) — não-eleitoral`, true, "");
  }
  critico(`Metadados: pesquisa #${i + 1} tem data`, !!(d.data && d.data.trim()), "data de campo ausente");
});

/* ── 4. Aritmética ──────────────────────────────────── */
const textoCompleto = JSON.stringify(r);
const percentuais = [...textoCompleto.matchAll(/(\d{1,3}(?:[.,]\d)?)\s*%/g)].map((m) => parseFloat(m[1].replace(",", ".")));
const impossiveis = percentuais.filter((p) => p > 100 || p < 0);
critico("Aritmética: nenhum percentual impossível", impossiveis.length === 0, `valores fora de 0-100%: ${impossiveis.join(", ")}`);

/* ── 5. Datas ───────────────────────────────────────── */
const hoje = new Date();
(r.pesquisas_dados?.destaques || []).forEach((d, i) => {
  const m = (d.data || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const dt = new Date(+m[3], +m[2] - 1, +m[1]);
    aviso(`Datas: pesquisa #${i + 1} não é futura`, dt <= hoje, `data ${d.data} está no futuro`);
  } else {
    aviso(`Datas: pesquisa #${i + 1} parseável`, false, `formato "${d.data}" não reconhecido (esperado dd/mm/aaaa)`);
  }
});

/* ── 6. URLs ────────────────────────────────────────── */
(r.cenario_macro || []).forEach((item, i) => {
  if (item.url && item.url.startsWith("http")) {
    const ok = dominiosPermitidos.some((dom) => item.url.includes(dom));
    aviso(`URL: item macro #${i + 1} em domínio da whitelist`, ok, item.url.slice(0, 60));
  }
});

/* ── 7. Auditoria aconteceu ─────────────────────────── */
critico("Auditoria: dupla passada registrada", !!r.auditoria?.realizada_em, "bloco de auditoria ausente — relatório não foi verificado");

/* ── Veredito ───────────────────────────────────────── */
console.log(log.join("\n"));
console.log("\n───────────────────────────────────────");
console.log(`  Passados: ${passados} · Avisos: ${avisos} · Críticos: ${criticos}`);

// Grava o resultado dos testes junto ao relatório (transparência)
r.testes_confiabilidade = {
  executados_em: new Date().toISOString(),
  passados, avisos, criticos,
  veredito: criticos === 0 ? "APROVADO" : "REPROVADO",
};
fs.writeFileSync(REPORT_PATH, JSON.stringify(r, null, 2));

if (criticos > 0) {
  console.log("\n✗ REPROVADO — publicação bloqueada. A edição anterior permanece no ar.");
  process.exit(1);
}
console.log("\n✓ APROVADO — relatório liberado para publicação.");
