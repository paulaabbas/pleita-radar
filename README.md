# Pleita Radar Político — Sistema de Inteligência Diária

Sistema automatizado de inteligência política para campanhas 2026.
**Atualização diária às 6h (Brasília), publicada sempre no mesmo link, sem intervenção manual.**

---

## Como funciona

Todo dia às 6h, o GitHub Actions executa o pipeline em 3 etapas:

1. **Geração** — Claude com busca na web varre exclusivamente as fontes da whitelist (`config/fontes.json`) e monta o relatório com as 7 seções
2. **Auditoria** — Uma segunda chamada independente verifica cada número contra as fontes citadas: pesquisas sem registro TSE são removidas, dados divergentes são corrigidos, fontes fora da whitelist são descartadas
3. **Publicação** — O HTML final é publicado em `docs/index.html` (seu link fixo via GitHub Pages) e arquivado em `docs/historico/` (série temporal — ativo estratégico da Pleita)

## Seções do relatório

| # | Seção | O que entrega |
|---|-------|---------------|
| 01 | Cenário Macro Político | Notícias verificadas com impacto eleitoral |
| 02 | Pesquisas & Dados | Institutos com registro TSE, amostra e margem |
| 03 | **Narrativas por Perfil** ✨ | Leitura + posicionamento + timing + risco para Situação, Oposição e Centro |
| 04 | Pulso Digital | UGC: Instagram, TikTok, YouTube, X |
| 05 | Tendências do Setor | Com grau de urgência e oportunidade |
| 06 | Linha Editorial | Carrossel, Reels e LinkedIn prontos para criar |
| 07 | Insumos Pleita | Sinais fracos, adversários, alertas |
| ✓ | Selo de Auditoria | Transparência: quantos itens verificados, corrigidos, removidos |

---

## Setup (feito uma única vez, ~15 minutos)

### 1. Criar conta e repositório no GitHub
1. Acesse [github.com](https://github.com) e crie uma conta (gratuita)
2. Clique em **New repository** → nome: `pleita-radar` → deixe **Private** → **Create**

### 2. Subir os arquivos
1. No repositório, clique em **uploading an existing file**
2. Arraste TODO o conteúdo desta pasta (incluindo as pastas `.github`, `scripts`, `config`, `docs`)
3. **Commit changes**

> ⚠️ A pasta `.github` é oculta em alguns sistemas. Se o upload pelo navegador não a incluir, crie o arquivo manualmente: **Add file → Create new file** → digite `.github/workflows/radar.yml` no nome → cole o conteúdo do arquivo.

### 3. Guardar a chave de API (segredo do servidor)
1. No repositório: **Settings → Secrets and variables → Actions**
2. **New repository secret**
3. Nome: `ANTHROPIC_API_KEY`
4. Valor: sua chave (obtida em [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys))
5. **Add secret**

A chave fica criptografada no GitHub. Nunca aparece no site, nunca é exposta a visitantes.

### 4. Ativar o GitHub Pages (seu link fixo)
1. **Settings → Pages**
2. Em *Source*: **Deploy from a branch**
3. Branch: `main` · Pasta: `/docs` → **Save**
4. Em ~2 minutos seu link estará ativo: `https://SEU-USUARIO.github.io/pleita-radar/`

> Para usar domínio próprio (ex: `radar.pleita.com.br`), configure em Settings → Pages → Custom domain.

### 5. Primeira geração (teste)
1. Aba **Actions** → workflow **Pleita Radar — Geração Diária**
2. Botão **Run workflow** → **Run workflow**
3. Aguarde ~3-5 minutos. Ao concluir, abra seu link do Pages — o relatório do dia estará lá.

A partir daí, **todo dia às 6h da manhã o relatório se renova sozinho no mesmo link.**

---

## Custos

- GitHub (repositório + Actions + Pages): **gratuito**
- API Anthropic: ~US$ 0,15–0,40 por relatório diário (geração + auditoria com Sonnet) ≈ **US$ 5–12/mês**

## Manutenção

- **Editar fontes confiáveis**: `config/fontes.json` — adicione ou remova veículos/institutos
- **Ajustar horário**: `.github/workflows/radar.yml` — linha do `cron` (formato UTC; 6h BRT = 9h UTC)
- **Gerar fora do horário**: aba Actions → Run workflow
- **Histórico**: cada edição fica salva em `docs/historico/radar-AAAA-MM-DD.{html,json}` — sua série temporal proprietária

## Governança de acurácia

Regras codificadas em `config/fontes.json` e aplicadas pelo auditor:
- Pesquisa eleitoral **sem registro TSE → não publica**
- Pesquisa sem data de campo → não publica
- Fonte fora da whitelist → item inteiro descartado
- Números divergentes entre institutos → publica ambos com atribuição
- Dado não verificável na busca → removido

O selo **✓ Auditado** no rodapé de cada edição informa quantos itens foram verificados, corrigidos e removidos — transparência que vira argumento comercial junto a juristas e assessores.

---

*Pleita Branding Político · Paula Abbas · pleita.com.br*
