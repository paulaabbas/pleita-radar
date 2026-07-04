/**
 * PLEITA RADAR POLÍTICO — Gerador Diário
 * ─────────────────────────────────────────
 * Pipeline em 3 etapas:
 *   1. GERAÇÃO   — Claude + web search varre fontes da whitelist e monta o relatório
 *   2. AUDITORIA — Segunda chamada verifica cada número contra as fontes citadas
 *   3. RENDER    — HTML final publicado em docs/index.html (GitHub Pages)
 *
 * Executado diariamente às 6h (BRT) via GitHub Actions.
 * Chave de API: variável de ambiente ANTHROPIC_API_KEY (GitHub Secret).
 */

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error("ERRO: ANTHROPIC_API_KEY não configurada."); process.exit(1); }

const ROOT = path.join(__dirname, "..");
const FONTES = JSON.parse(fs.readFileSync(path.join(ROOT, "config/fontes.json"), "utf8"));
const MODEL = "claude-sonnet-4-6"; // Sonnet para máxima qualidade de análise estratégica

/* ── Utilidades ─────────────────────────────────────────── */

const hoje = new Date().toLocaleDateString("pt-BR", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
  timeZone: "America/Sao_Paulo",
});
const hojeCurto = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const horaAgora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function sanitizeJSON(raw) {
  let s = raw.replace(/```json|```/g, "");
  const st = s.indexOf("{"), en = s.lastIndexOf("}");
  if (st === -1 || en === -1) throw new Error("JSON não encontrado na resposta");
  s = s.substring(st, en + 1);
  let out = "", inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { out += c; esc = false; continue; }
    if (c === "\\") { esc = true; out += c; continue; }
    if (c === '"') { inStr = !inStr; out += c; continue; }
    if (inStr) {
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
      if (c.charCodeAt(0) < 32) continue;
    }
    out += c;
  }
  return out.replace(/,\s*([\]}])/g, "$1");
}

async function callClaude(system, userMsg, useSearch = true) {
  const body = {
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: userMsg }],
  };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error("API: " + data.error.message);
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

/* ── ETAPA 1: Geração ───────────────────────────────────── */

const whitelistJornais = FONTES.jornalismo.map((f) => f.nome).join(", ");
const whitelistInstitutos = FONTES.institutos_pesquisa.map((f) => f.nome).join(", ");

const SYSTEM_GERACAO = `Voce e o RADAR POLITICO da Pleita Branding Politico, sistema de inteligencia estrategica de Paula Abbas. Publico-alvo: candidatos, assessores parlamentares, secretarios de comunicacao e juristas construindo campanhas para 2026. O valor central e SINTESE ESTRATEGICA CONFIAVEL — nao velocidade.

FONTES PERMITIDAS (whitelist rigida — cite APENAS estas):
Jornalismo: ${whitelistJornais}
Institutos: ${whitelistInstitutos}

REGRA DE OURO: se um dado nao veio de fonte da whitelist, NAO o inclua. Melhor um relatorio menor e 100% verificavel do que um relatorio cheio e frágil.

REGRAS PARA PESQUISAS ELEITORAIS (obrigatorias):
- SEMPRE incluir: numero de registro TSE, data de campo, tamanho da amostra, margem de erro
- Pesquisa sem registro TSE = NAO PUBLICAR
- Se dois institutos divergem, publique ambos com atribuicao clara

BUSQUE HOJE nas fontes permitidas:
1. Noticias politicas mais relevantes das ultimas 24-48 horas
2. Pesquisas eleitorais e de aprovacao mais recentes (com metadados TSE completos)
3. Movimentos de pre-candidatos presidenciais e estaduais 2026
4. Pautas do STF, Congresso e Executivo com impacto eleitoral
5. Indicadores economicos com leitura politica (IPCA, Selic, emprego, PIB)
6. Temas em alta nas redes sociais sobre politica

Retorne APENAS JSON valido, sem markdown, sem texto fora do bloco:
{
"data_relatorio":"${hojeCurto}",
"temperatura_politica":"QUENTE|MORNA|FRIA",
"resumo_executivo":"3-4 frases de sintese estrategica do dia para tomadores de decisao de campanha",
"cenario_macro":[{"titulo":"...","descricao":"2-3 frases com fatos e numeros","fonte":"nome da fonte da whitelist","url":"url real ou vazio","relevancia":"ALTA|MEDIA|BAIXA","impacto_eleitoral":"leitura para campanhas 2026"}],
"pesquisas_dados":{"destaques":[{"instituto":"...","data":"dd/mm/aaaa","registro_tse":"BR-XXXXX/2026 ou N/A para nao-eleitorais","amostra":"N entrevistados","margem":"X pp","dado_principal":"...","contexto":"significado politico em 1-2 frases","fonte_url":"..."}],"numero_semana":"o dado mais estrategico com contexto","interpretacao":"leitura para o consultor de branding politico","tendencia_aprovacao":"SUBINDO|ESTAVEL|CAINDO"},
"narrativas_por_perfil":{"contexto":"a narrativa dominante do dia em 1 frase","situacao":{"leitura":"como o campo governista deve ler o dia","posicionamento":"o que comunicar","timing":"quando agir","risco":"o que evitar"},"oposicao":{"leitura":"...","posicionamento":"...","timing":"...","risco":"..."},"centro_independente":{"leitura":"...","posicionamento":"...","timing":"...","risco":"..."}},
"pulso_digital":{"instagram":["..."],"tiktok":["..."],"youtube":["..."],"x_twitter":["..."],"hashtags_em_alta":["#..."],"sentimento_geral":"POLARIZADO|NEGATIVO|POSITIVO|NEUTRO","temas_virais":["..."]},
"tendencias_setor":[{"tendencia":"...","descricao":"...","oportunidade":"...","urgencia":"IMEDIATA|CURTO_PRAZO|MEDIO_PRAZO"}],
"linha_editorial":{"tema_semana":"...","narrativa_mestra":"...","conteudos_sugeridos":[{"formato":"carrossel","plataforma":"instagram","titulo":"...","angulo":"...","gancho":"...","estrutura":"Slide 1: ...\\nSlide 2: ...","cta":"..."},{"formato":"reels","plataforma":"instagram","titulo":"...","angulo":"...","gancho":"...","estrutura":"0-3s: ...\\n3-15s: ...","cta":"..."},{"formato":"post","plataforma":"linkedin","titulo":"...","angulo":"...","gancho":"...","estrutura":"...","cta":"..."}],"temas_evitar":["..."],"janelas_oportunidade":["..."]},
"insumos_pleita":{"sinais_fracos":["..."],"movimentos_adversarios":["..."],"oportunidades_posicionamento":["..."],"alertas":["..."],"proxima_semana":"o que monitorar"}
}

Minimo: 6 itens em cenario_macro, 3 em pesquisas_dados.destaques (se houver pesquisas com registro valido), 4 em tendencias_setor.
REGRAS JSON: zero quebras de linha literais dentro de strings, zero aspas duplas em valores, zero virgula final.`;

/* ── ETAPA 2: Auditoria ─────────────────────────────────── */

const SYSTEM_AUDITORIA = `Voce e o AUDITOR DE ACURACIA do Pleita Radar Politico. Sua unica funcao: verificar numeros e fontes de um relatorio antes da publicacao. Publico inclui juristas — um numero errado destroi a credibilidade do produto.

PROTOCOLO:
1. Para cada pesquisa eleitoral citada: busque na web e confirme instituto, data, percentuais, registro TSE, amostra e margem. Se qualquer campo divergir, CORRIJA com o valor verificado. Se nao conseguir verificar, REMOVA o item.
2. Para cada item de cenario_macro: confirme que a noticia existe na fonte citada. Se a fonte estiver fora da whitelist (${whitelistJornais}, ${whitelistInstitutos}), REMOVA o item.
3. Verifique aritmetica: percentuais que somam mais de 100% sem justificativa, diferencas calculadas erradas, datas impossiveis.
4. NAO adicione conteudo novo. Apenas corrija, remova ou mantenha.

Retorne o relatorio COMPLETO corrigido no MESMO formato JSON, acrescentando no final do objeto:
"auditoria":{"realizada_em":"${hojeCurto} ${horaAgora}","itens_verificados":N,"itens_corrigidos":N,"itens_removidos":N,"observacoes":"resumo do que foi ajustado ou confirmado"}

REGRAS JSON: zero quebras de linha literais dentro de strings, zero virgula final. Retorne APENAS o JSON.`;

/* ── ETAPA 3: Render ────────────────────────────────────── */

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function relClass(r) { return r === "ALTA" ? "rA" : r === "MEDIA" ? "rM" : "rB"; }
function urgClass(u) { return !u ? "" : u.startsWith("I") ? "uI" : u.startsWith("C") ? "uC" : "uM"; }

function render(r) {
  const template = fs.readFileSync(path.join(ROOT, "scripts/template.html"), "utf8");

  const tc = (r.temperatura_politica || "MORNA").toLowerCase();
  const tempEmoji = tc === "quente" ? "🔴" : tc === "morna" ? "🟡" : "🔵";

  let body = "";

  // EXEC
  body += `<div class="exec"><div class="exec-l">Resumo Executivo · ${esc(r.data_relatorio)}</div><div class="exec-t">${esc(r.resumo_executivo)}</div></div>`;

  // 01 CENÁRIO MACRO
  if (r.cenario_macro?.length) {
    body += `<div class="sec"><span class="stamp">01</span><h2 class="sec-t">Cenário Macro Político</h2><div class="rule"></div><span class="sec-s">Publishers verificados</span></div><div class="ng">`;
    r.cenario_macro.forEach((item, i) => {
      const feat = i === 0 ? " feat" : "";
      const img = i === 0 ? '<div class="feat-img"></div>' : "";
      const src = item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.fonte)}</a>` : esc(item.fonte);
      body += `<div class="nc${feat}">${img}<div style="flex:1;display:flex;flex-direction:column">
        <div class="nc-top"><span class="nc-src">${src}</span><span class="rel ${relClass(item.relevancia)}">${esc(item.relevancia)}</span></div>
        <div class="nc-t">${esc(item.titulo)}</div><div class="nc-b">${esc(item.descricao)}</div>
        ${item.impacto_eleitoral ? `<div class="nc-imp"><div class="imp-l">↗ Impacto Eleitoral 2026</div><div class="imp-t">${esc(item.impacto_eleitoral)}</div></div>` : ""}
      </div></div>`;
    });
    body += `</div>`;
  }

  // 02 PESQUISAS
  const pp = r.pesquisas_dados;
  if (pp) {
    body += `<div class="sec"><span class="stamp">02</span><h2 class="sec-t">Pesquisas &amp; Dados Quantitativos</h2><div class="rule"></div><span class="sec-s">Verificados com registro TSE</span></div><div class="pg">`;
    (pp.destaques || []).forEach((d) => {
      const meta = [d.registro_tse, d.amostra, d.margem ? "±" + d.margem : ""].filter(Boolean).join(" · ");
      body += `<div class="pc"><div class="pc-head"><span class="pc-inst">${esc(d.instituto)}</span><span class="pc-date">${esc(d.data)}</span></div>
        <div class="pc-num">${esc(d.dado_principal)}</div><div class="pc-ctx">${esc(d.contexto)}</div>
        ${meta ? `<div class="pc-meta">${esc(meta)}</div>` : ""}
        ${d.fonte_url ? `<a href="${esc(d.fonte_url)}" target="_blank" rel="noopener" class="pc-link">${esc(d.instituto)} →</a>` : ""}
      </div>`;
    });
    body += `</div>`;
    if (pp.numero_semana || pp.interpretacao) {
      const ta = pp.tendencia_aprovacao || "ESTAVEL";
      const taE = ta === "SUBINDO" ? "↑" : ta === "CAINDO" ? "↓" : "→";
      body += `<div class="ph"><div class="ph-l"><div class="ph-label">Número do Dia</div>
        <div class="ph-val">${esc(pp.numero_semana)}</div>
        <span class="ta-badge">${taE} Aprovação ${esc(ta)}</span></div>
        <div class="ph-r"><div class="ph-label">Leitura Estratégica Pleita</div>
        <div class="ph-text">${esc(pp.interpretacao)}</div></div></div>`;
    }
  }

  // 03 NARRATIVAS POR PERFIL (nova seção)
  const np = r.narrativas_por_perfil;
  if (np) {
    body += `<div class="sec"><span class="stamp">03</span><h2 class="sec-t">Narrativas por Perfil de Candidato</h2><div class="rule"></div><span class="sec-s">Posicionamento em tempo real</span></div>`;
    if (np.contexto) body += `<div class="np-ctx">${esc(np.contexto)}</div>`;
    body += `<div class="npg">`;
    [["situacao", "🏛 Situação / Governismo", "np-sit"], ["oposicao", "⚔ Oposição", "np-opo"], ["centro_independente", "◈ Centro / Independente", "np-cen"]].forEach(([key, label, cls]) => {
      const p = np[key];
      if (!p) return;
      body += `<div class="npc ${cls}"><div class="np-h">${label}</div>
        <div class="np-row"><span class="np-k">Leitura</span><span class="np-v">${esc(p.leitura)}</span></div>
        <div class="np-row"><span class="np-k">Posicionamento</span><span class="np-v">${esc(p.posicionamento)}</span></div>
        <div class="np-row"><span class="np-k">Timing</span><span class="np-v">${esc(p.timing)}</span></div>
        <div class="np-row risco"><span class="np-k">⚠ Risco</span><span class="np-v">${esc(p.risco)}</span></div>
      </div>`;
    });
    body += `</div>`;
  }

  // 04 PULSO DIGITAL
  const pd = r.pulso_digital;
  if (pd) {
    body += `<div class="sec"><span class="stamp">04</span><h2 class="sec-t">Pulso Digital</h2><div class="rule"></div><span class="sec-s">UGC &amp; Redes Sociais</span></div><div class="dg">`;
    [["instagram", "📸", "Instagram"], ["tiktok", "🎵", "TikTok"], ["youtube", "▶️", "YouTube"], ["x_twitter", "𝕏", "X / Twitter"]].forEach(([k, ic, lb]) => {
      const items = pd[k];
      if (!items?.length) return;
      body += `<div class="plat"><div class="plat-hd"><span class="plat-ic">${ic}</span><span class="plat-nm">${lb}</span></div>${items.map((t) => `<div class="tr-i"><span class="tr-a">↗</span>${esc(t)}</div>`).join("")}</div>`;
    });
    body += `</div><div class="df"><div>
      <div class="df-label gold-l">Hashtags em Alta</div>
      <div class="hc">${(pd.hashtags_em_alta || []).map((t) => `<span class="ht">${esc(t)}</span>`).join("")}</div>
      ${pd.temas_virais?.length ? `<div class="df-label muted-l" style="margin-top:14px">Temas Virais</div><div class="virais">${pd.temas_virais.map((t) => `<span class="viral">${esc(t)}</span>`).join("")}</div>` : ""}
    </div>
    <div class="sb"><div class="sb-l">Sentimento Geral</div><div class="sv">${esc(pd.sentimento_geral)}</div>
    <div class="sb-note">Análise cruzada: Instagram · TikTok · YouTube · X/Twitter</div></div></div>`;
  }

  // 05 TENDÊNCIAS
  if (r.tendencias_setor?.length) {
    body += `<div class="sec"><span class="stamp">05</span><h2 class="sec-t">Tendências do Setor Político</h2><div class="rule"></div></div><div class="tdg">`;
    r.tendencias_setor.forEach((t) => {
      body += `<div class="tdc"><div class="td-top"><div class="td-name">${esc(t.tendencia)}</div><span class="urg ${urgClass(t.urgencia)}">${esc((t.urgencia || "").replace(/_/g, " "))}</span></div>
        <div class="td-desc">${esc(t.descricao)}</div>
        ${t.oportunidade ? `<div class="td-opp"><div class="opp-l">💡 Oportunidade</div><div class="opp-t">${esc(t.oportunidade)}</div></div>` : ""}
      </div>`;
    });
    body += `</div>`;
  }

  // 06 LINHA EDITORIAL
  const le = r.linha_editorial;
  if (le) {
    body += `<div class="sec"><span class="stamp">06</span><h2 class="sec-t">Linha Editorial</h2><div class="rule"></div><span class="sec-s">Conteúdos prontos para criar</span></div>
    <div class="ed-hero"><div class="ed-img"></div><div class="ed-r">
      <div class="ed-tl">Tema do Dia</div><div class="ed-tema">${esc(le.tema_semana)}</div>
      ${le.narrativa_mestra ? `<div class="ed-narr">${esc(le.narrativa_mestra)}</div>` : ""}
    </div></div>`;
    if (le.conteudos_sugeridos?.length) {
      body += `<div class="cg">`;
      le.conteudos_sugeridos.forEach((c) => {
        body += `<div class="cc"><div class="cc-top"><span class="fmt">${esc(c.formato)}</span><span class="plt">${esc(c.plataforma)}</span></div>
          <div class="cc-t">${esc(c.titulo)}</div>
          ${c.angulo ? `<div class="cc-a">${esc(c.angulo)}</div>` : ""}
          ${c.gancho ? `<div class="cc-g">"${esc(c.gancho)}"</div>` : ""}
          ${c.estrutura ? `<div class="cc-s">${esc(c.estrutura)}</div>` : ""}
          ${c.cta ? `<div class="cc-cta"><div class="cta-l">CTA</div><div class="cta-t">${esc(c.cta)}</div></div>` : ""}
        </div>`;
      });
      body += `</div>`;
    }
    body += `<div class="ed-ft">`;
    if (le.temas_evitar?.length) body += `<div class="ed-blk"><div class="ed-bl-t d">⚠ Temas a Evitar</div><div class="evitar-wrap">${le.temas_evitar.map((t) => `<span class="evitar">✕ ${esc(t)}</span>`).join("")}</div></div>`;
    if (le.janelas_oportunidade?.length) body += `<div class="ed-blk"><div class="ed-bl-t s">✦ Janelas de Oportunidade</div>${le.janelas_oportunidade.map((j) => `<div class="janela"><span class="ja">→</span>${esc(j)}</div>`).join("")}</div>`;
    body += `</div>`;
  }

  // 07 INSUMOS PLEITA
  const ip = r.insumos_pleita;
  if (ip) {
    body += `<div class="sec"><span class="stamp">07</span><h2 class="sec-t">Insumos Sistema Pleita</h2><div class="rule"></div><span class="sec-s">Inteligência Estratégica</span></div><div class="ig">`;
    [["sinais_fracos", "📡 Sinais Fracos", "gold"], ["movimentos_adversarios", "⚔ Adversários", "red"], ["oportunidades_posicionamento", "✦ Posicionamento", "green"], ["alertas", "🔔 Alertas", "amber"]].forEach(([k, lb, cls]) => {
      const items = ip[k];
      if (!items?.length) return;
      body += `<div class="ib"><div class="ib-h ${cls}">${lb}</div>${items.map((i) => `<div class="ii"><span class="id">—</span>${esc(i)}</div>`).join("")}</div>`;
    });
    body += `</div>`;
    if (ip.proxima_semana) body += `<div class="prox"><div class="prox-a"><div class="prox-icon">🔭</div><div class="prox-al">Monitorar</div></div><div class="prox-b"><div class="prox-t">Radar de Amanhã</div><div class="prox-p">${esc(ip.proxima_semana)}</div></div></div>`;
  }

  // AUDITORIA (selo de confiabilidade)
  const au = r.auditoria;
  if (au) {
    body += `<div class="audit-seal">
      <div class="audit-icon">✓</div>
      <div class="audit-body">
        <div class="audit-title">Relatório Auditado</div>
        <div class="audit-text">Dupla verificação de acurácia realizada em ${esc(au.realizada_em)} · ${au.itens_verificados || 0} itens verificados · ${au.itens_corrigidos || 0} corrigidos · ${au.itens_removidos || 0} removidos por fonte não confirmada${au.observacoes ? " · " + esc(au.observacoes) : ""}</div>
      </div>
    </div>`;
  }

  return template
    .replace("{{DATA}}", esc(r.data_relatorio || hojeCurto))
    .replace("{{HORA}}", esc(horaAgora))
    .replace(/{{TEMP_CLASS}}/g, tc)
    .replace(/{{TEMP_EMOJI}}/g, tempEmoji)
    .replace(/{{TEMP}}/g, esc(r.temperatura_politica || ""))
    .replace("{{BODY}}", body);
}

/* ── Pipeline principal ─────────────────────────────────── */

(async () => {
  console.log("═══ PLEITA RADAR — Pipeline diário ═══");
  console.log("Data:", hoje);

  // ETAPA 1
  console.log("\n[1/3] Gerando relatório com busca em fontes verificadas...");
  const rawGen = await callClaude(
    SYSTEM_GERACAO,
    `Hoje é ${hoje}. Gere o relatório diário completo do Pleita Radar Político. Pesquise ativamente nas fontes da whitelist antes de escrever. Priorize acontecimentos das últimas 24-48 horas. REGRAS JSON: zero quebras de linha em strings, zero vírgulas finais. Retorne APENAS o JSON.`,
    true
  );
  let report = JSON.parse(sanitizeJSON(rawGen));
  console.log("  → Relatório gerado:", (report.cenario_macro || []).length, "itens macro,", (report.pesquisas_dados?.destaques || []).length, "pesquisas.");

  // ETAPA 2
  console.log("\n[2/3] Auditoria de acurácia (segunda passada)...");
  try {
    const rawAudit = await callClaude(
      SYSTEM_AUDITORIA,
      `Audite este relatório antes da publicação. Verifique cada número contra as fontes na web. Retorne o JSON completo corrigido com o bloco "auditoria" ao final:\n\n${JSON.stringify(report)}`,
      true
    );
    report = JSON.parse(sanitizeJSON(rawAudit));
    console.log("  → Auditoria:", report.auditoria?.observacoes || "concluída");
  } catch (e) {
    console.warn("  ⚠ Auditoria falhou (" + e.message + "). Publicando versão da Etapa 1 com aviso.");
    report.auditoria = { realizada_em: hojeCurto + " " + horaAgora, itens_verificados: 0, itens_corrigidos: 0, itens_removidos: 0, observacoes: "Auditoria automática indisponível nesta execução — relatório publicado a partir da geração primária" };
  }

  // ETAPA 3
  console.log("\n[3/3] Renderizando HTML...");
  const html = render(report);
  const outDir = path.join(ROOT, "docs");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);

  // Arquivo histórico (série temporal — ativo da Pleita)
  const histDir = path.join(outDir, "historico");
  fs.mkdirSync(histDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(histDir, `radar-${stamp}.json`), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(histDir, `radar-${stamp}.html`), html);

  // Dados para a área do cliente
  const dadosDir = path.join(outDir, "dados");
  fs.mkdirSync(dadosDir, { recursive: true });
  fs.writeFileSync(path.join(dadosDir, "latest.json"), JSON.stringify(report, null, 2));

  // Índice de datas disponíveis (navegação de histórico)
  const datasPath = path.join(dadosDir, "datas.json");
  let datas = [];
  if (fs.existsSync(datasPath)) { try { datas = JSON.parse(fs.readFileSync(datasPath, "utf8")); } catch {} }
  if (!datas.includes(stamp)) datas.push(stamp);
  datas.sort().reverse();
  fs.writeFileSync(datasPath, JSON.stringify(datas));

  // Registro público de clientes (apenas hashes — códigos nunca expostos)
  const clientesPath = path.join(ROOT, "config/clientes.json");
  if (fs.existsSync(clientesPath)) {
    const crypto = require("crypto");
    const cfgClientes = JSON.parse(fs.readFileSync(clientesPath, "utf8"));
    const clientes = Array.isArray(cfgClientes) ? cfgClientes : (cfgClientes.clientes || []);
    const pub = clientes.map((c) => ({
      hash: crypto.createHash("sha256").update(c.codigo_acesso).digest("hex"),
      nome: c.nome, perfil: c.perfil, estado: c.estado || "", cargo: c.cargo || "",
    }));
    fs.writeFileSync(path.join(dadosDir, "clientes-pub.json"), JSON.stringify(pub));
    console.log("✓ Área do cliente: " + pub.length + " acesso(s) publicado(s) (hash-only)");
  }

  console.log("\n✓ Publicado: docs/index.html");
  console.log("✓ Dados: docs/dados/latest.json");
  console.log("✓ Histórico: docs/historico/radar-" + stamp + ".{json,html}");
})().catch((e) => { console.error("FALHA NO PIPELINE:", e.message); process.exit(1); });
