# PRIZELY — ESPECIFICAÇÃO DE MARCA (FINAL)

Documento de referência da identidade Prizely. Substitui, para fins de
implementação, as explorações em `simbolo-conceitos.md` — aqui só entra o que
foi decidido.

---

## 1. Essência

Prizely transforma eventos dispersos do negócio (conversa, venda, visita,
retorno) em entendimento contínuo — a camada de inteligência entre o digital
e o físico.

## 2. Direção conceitual — "The Layer"

Metáfora: uma camada de leitura clara sobreposta ao negócio real. O negócio
físico/humano é sólido, cheio, opaco — a Prizely não o substitui, ela lê por
cima dele e devolve clareza. Dois planos: um bloco sólido (o negócio, a
realidade) e um contorno deslocado por cima (a leitura, o entendimento).

Por que funciona pra Prizely: literaliza o princípio central do produto
("complexidade invisível, clareza visível") sem virar ícone de gráfico,
dashboard ou dado genérico. Funciona igual em papel, tela e metal (tag NFC).

Tensão que o símbolo carrega: **Humanidade × Inteligência** — o bloco sólido é
o humano/físico; o contorno é a leitura analítica por cima, nunca o
contrário.

## 3. Personalidade

Autoridade (não "amigável-bobo"), madura, moderna sem ser trend, sofisticada
mas acessível, tecnológica com calor humano.

**Evitar meticulosamente**: gráfico de linha ascendente (growth chart de
SaaS), hexágono tech, ícone genérico de dado/gráfico, robô, roxo-azul
genérico, glassmorphism como base visual, qualquer motivo de "fio"/costura
(explorado e descartado).

## 4. Símbolo — The Layer

Dois retângulos de cantos arredondados (`rx` ≈ 15% da largura), sobrepostos
com deslocamento diagonal:

- **Camada de trás** (o negócio real): preenchida com **Ink**, sólida.
- **Camada da frente** (a leitura da Prizely): preenchida com **Plaster** (ou
  transparente sobre fundo escuro), contorno em **Ink**, deslocada para
  cima/esquerda em relação à de trás.

Markup de referência (mesma proporção em qualquer tamanho):

```svg
<svg viewBox="0 0 120 120">
  <rect x="25" y="25" width="95" height="95" rx="14" fill="var(--color-ink)" />
  <rect x="0" y="0" width="95" height="95" rx="14"
        fill="var(--color-plaster)" stroke="var(--color-ink)" stroke-width="7" />
</svg>
```

### Regras de uso

- Monocromático por padrão (Ink + Plaster). Cor entra **apenas** como
  substituição pontual da camada de trás para marcar estado/contexto — nunca
  nas duas camadas ao mesmo tempo:
  - **Brass** → confirmação, toque, ação primária (ex.: tela de check-in).
  - **Verdigris** → reconhecimento, recorrência, positivo (ex.: cliente
    recorrente).
- Nunca preencher as duas camadas com a mesma cor — a leitura de
  "sólido + contorno deslocado" é o que sustenta o conceito; perder o
  deslocamento ou o contraste entre as camadas invalida o símbolo.
- Tamanho mínimo recomendado: 20px (favicon/sidebar) sem stroke abaixo de
  ~2px equivalente proporcional.
- Não girar, não espelhar, não adicionar terceira camada.

## 5. Paleta

### Tema claro (padrão)

| Papel | Nome | Hex |
|---|---|---|
| Fundo | Plaster | `#F3EEE5` |
| Texto/símbolo principal | Ink | `#1B1812` |
| Texto secundário | Warm gray | `#8C8477` |
| Accent primário (confirmação/ação) | Brass | `#A8763E` |
| Accent secundário (positivo/recorrência) | Verdigris | `#5C6E5F` |
| Negativo/alerta (uso pontual, badges) | Terracotta | `#B4553C` |

### Tema escuro

| Papel | Hex |
|---|---|
| Fundo | `#17140F` |
| Superfície / card | `#211D16` |
| Borda | `#332C21` |
| Texto principal | `#F3EEE5` |
| Texto secundário | `#A89C8A` |
| Accent primário (Brass, mais claro p/ contraste) | `#C89456` |
| Accent secundário (Verdigris, mais claro p/ contraste) | `#7C9689` |

Regra geral: no escuro, o card/superfície nunca é preto puro — é sempre um
tom quente derivado do Ink, nunca cinza neutro. Os accents ficam ~15–20%
mais claros que no tema claro para manter contraste em fundo escuro.

## 6. Tipografia

| Uso | Fonte | Peso/estilo |
|---|---|---|
| Display / wordmark / headlines | **Fraunces** (variável) | 440–480, `WONK` leve, tracking -0.01em em títulos grandes |
| UI, labels, corpo, tabelas | **Instrument Sans** | 400–600 |

Wordmark "Prizely" sempre em Fraunces, nunca em caixa alta, nunca com o
símbolo dentro do texto.

## 7. Voz e tom

- Direto, sem jargão técnico pro usuário final (ex.: "Faça seu check-in", não
  "Registrar evento de visita").
- Admin pode usar termos de negócio (Taxa de retorno, Clientes recorrentes,
  Conversão) — o dono do negócio já entende esses termos.
- Nunca gamificado/fofo. Autoridade calma, não hype.

## 8. Arquitetura de marca

**Branded house**: Prizely é a marca-mãe; produtos levam o nome dela.

- **Prizely** (CRM) — inteligência comercial: leads, origem, conversão,
  faturamento.
- **Prizely Tap** — check-in físico via NFC/QR, reconhecimento de clientes
  recorrentes, ponte entre visita física e dado digital.

Os dois compartilham símbolo, paleta e tipografia integralmente — a única
variação são os accents de estado (Brass/Verdigris) conforme o contexto da
tela.

## 9. Aplicações já validadas

- Logo/wordmark, paleta e tipografia — `Page 1` do arquivo Paper
  (`01 — Logo & Símbolo`, `02 — Paleta & Tipografia`).
- Tag NFC física e card de dashboard — `Page 1`, `03` e `04`.
- Telas do CRM (Leads, Painel) — página "CRM — Telas (nova identidade)".
- Telas do Prizely Tap (check-in, boas-vindas de volta, admin) — página
  "Prizely Tap — Telas (nova identidade)".
- Tema escuro — em andamento (limite de uso do Paper MCP atingido; retomar
  quando resetar).

## 10. Critério de aceite para qualquer novo material de marca

- Símbolo é sempre o Layer (seção 4) — nenhuma outra forma de símbolo é
  válida para a marca.
- Nunca usar gráfico de linha ascendente como decoração ou ícone.
- Cor de accent nunca ocupa mais do que um elemento de destaque por tela.
- Fundo claro é Plaster, nunca branco puro; fundo escuro nunca é preto puro.
