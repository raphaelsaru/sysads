import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Matheus Leandro — Relatório Meta Ads 2026</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0a0a0f;
    --surface: #12121a;
    --surface-2: #1a1a27;
    --surface-3: #222234;
    --border: #2a2a3d;
    --text: #e8e8f0;
    --text-dim: #8888a8;
    --accent: #6c5ce7;
    --accent-glow: #6c5ce744;
    --green: #00e676;
    --green-dim: #00e67633;
    --red: #ff5252;
    --red-dim: #ff525233;
    --amber: #ffab40;
    --amber-dim: #ffab4033;
    --cyan: #18ffff;
    --cyan-dim: #18ffff22;
    --pink: #ff6b9d;
    --gradient-1: linear-gradient(135deg, #6c5ce7 0%, #a855f7 50%, #ec4899 100%);
    --gradient-2: linear-gradient(135deg, #00e676 0%, #18ffff 100%);
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Outfit', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  body::before {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background:
      radial-gradient(ellipse 80% 50% at 20% 10%, #6c5ce711 0%, transparent 50%),
      radial-gradient(ellipse 60% 40% at 80% 80%, #ec489911 0%, transparent 50%),
      radial-gradient(ellipse 40% 30% at 50% 50%, #18ffff08 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  .noise {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 40px 24px;
    position: relative;
    z-index: 1;
  }

  .header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 48px;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
    gap: 20px;
  }

  .header-left h1 {
    font-size: 42px;
    font-weight: 800;
    letter-spacing: -1.5px;
    background: var(--gradient-1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.1;
  }

  .header-left .subtitle {
    font-family: 'Space Mono', monospace;
    font-size: 13px;
    color: var(--text-dim);
    margin-top: 8px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .header-right {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 100px;
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    letter-spacing: 0.5px;
  }

  .badge-live {
    background: var(--green-dim);
    color: var(--green);
    border: 1px solid #00e67644;
  }

  .badge-live::before {
    content: '';
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--green);
    animation: pulse 2s infinite;
  }

  .badge-period {
    background: var(--surface-2);
    color: var(--text-dim);
    border: 1px solid var(--border);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 40px;
  }

  .kpi-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .kpi-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px var(--accent-glow);
  }

  .kpi-card::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: var(--gradient-1);
    opacity: 0;
    transition: opacity 0.3s;
  }

  .kpi-card:hover::after { opacity: 1; }

  .kpi-label {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--text-dim);
    margin-bottom: 12px;
  }

  .kpi-value {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -1px;
    line-height: 1;
  }

  .kpi-sub {
    font-size: 13px;
    color: var(--text-dim);
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .kpi-sub .up { color: var(--green); }
  .kpi-sub .down { color: var(--red); }

  .section { margin-bottom: 40px; }

  .section-title {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .section-title .dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 12px var(--accent-glow);
  }

  .chart-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 40px;
  }

  @media (max-width: 900px) {
    .chart-grid { grid-template-columns: 1fr; }
    .chart-box.full { grid-column: auto; }
  }

  .chart-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    transition: border-color 0.3s;
  }

  .chart-box:hover { border-color: var(--surface-3); }

  .chart-box h3 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 16px;
    color: var(--text-dim);
  }

  .chart-box.full { grid-column: 1 / -1; }

  .chart-wrapper {
    position: relative;
    height: 280px;
  }

  .table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  thead { background: var(--surface-2); }

  th {
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-dim);
    padding: 16px 20px;
    text-align: left;
    white-space: nowrap;
  }

  td {
    padding: 16px 20px;
    border-top: 1px solid var(--border);
    white-space: nowrap;
  }

  tr:hover td { background: var(--surface-2); }

  .campaign-name {
    font-weight: 600;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 100px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .status-active { background: var(--green-dim); color: var(--green); }
  .status-paused { background: var(--amber-dim); color: var(--amber); }

  .metric-highlight {
    font-family: 'Space Mono', monospace;
    font-weight: 700;
    font-size: 13px;
  }

  .month-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 40px;
  }

  @media (max-width: 700px) {
    .month-grid { grid-template-columns: 1fr; }
  }

  .month-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 28px;
  }

  .month-card h3 { font-size: 18px; font-weight: 700; margin-bottom: 20px; }

  .month-stat {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
  }

  .month-stat:last-child { border-bottom: none; }
  .month-stat-label { color: var(--text-dim); }

  .month-stat-value {
    font-family: 'Space Mono', monospace;
    font-weight: 700;
  }

  .footer {
    text-align: center;
    padding: 40px 0 20px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--text-dim);
    font-family: 'Space Mono', monospace;
    letter-spacing: 1px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    background: var(--surface);
    border-radius: 12px;
    padding: 4px;
    border: 1px solid var(--border);
    width: fit-content;
  }

  .tab {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-dim);
    border: none;
    background: none;
    font-family: 'Outfit', sans-serif;
  }

  .tab:hover { color: var(--text); background: var(--surface-2); }
  .tab.active {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 2px 12px var(--accent-glow);
  }

  .fade-in {
    opacity: 0;
    transform: translateY(20px);
    animation: fadeIn 0.6s ease forwards;
  }

  @keyframes fadeIn {
    to { opacity: 1; transform: translateY(0); }
  }

  .delay-1 { animation-delay: 0.1s; }
  .delay-2 { animation-delay: 0.2s; }
  .delay-3 { animation-delay: 0.3s; }
  .delay-4 { animation-delay: 0.4s; }
  .delay-5 { animation-delay: 0.5s; }
  .delay-6 { animation-delay: 0.6s; }

  .insights-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .insights-full { grid-column: 1 / -1; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 3px; }

  @media (max-width: 600px) {
    .container { padding: 20px 14px; }
    .header { flex-direction: column; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; gap: 14px; }
    .header-left h1 { font-size: 28px; }
    .header-left .subtitle { font-size: 11px; letter-spacing: 1px; }
    .header-right { flex-wrap: wrap; gap: 8px; }
    .badge { font-size: 10px; padding: 6px 12px; }
    .kpi-grid { grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 28px; }
    .kpi-card { padding: 16px; }
    .kpi-value { font-size: 22px; }
    .kpi-label { font-size: 9px; letter-spacing: 1px; margin-bottom: 8px; }
    .kpi-sub { font-size: 11px; flex-wrap: wrap; }
    .section-title { font-size: 17px; }
    .chart-grid { gap: 14px; }
    .chart-box { padding: 16px; }
    .chart-box h3 { font-size: 13px; }
    .chart-wrapper { height: 220px; }
    .month-grid { grid-template-columns: 1fr; gap: 14px; }
    .month-card { padding: 20px; }
    .month-card h3 { font-size: 16px; }
    .month-stat { font-size: 13px; padding: 8px 0; }
    .table-wrap { border-radius: 12px; }
    table { font-size: 12px; }
    th { padding: 12px 14px; font-size: 9px; }
    td { padding: 12px 14px; }
    .campaign-name { max-width: 180px; font-size: 12px; }
    .insights-grid { grid-template-columns: 1fr; }
    .insights-full { grid-column: auto; }
    .month-card p { font-size: 13px !important; }
  }

  @media (max-width: 380px) {
    .kpi-grid { grid-template-columns: 1fr; }
    .kpi-value { font-size: 26px; }
    .header-left h1 { font-size: 24px; }
  }
</style>
</head>
<body>
<div class="noise"></div>
<div class="container">

  <div class="header fade-in">
    <div class="header-left">
      <h1>Matheus Leandro</h1>
      <div class="subtitle">Emit&ecirc; Visuals &mdash; act_177241952340672</div>
    </div>
    <div class="header-right">
      <span class="badge badge-live">2 campanhas ativas</span>
      <span class="badge badge-period">01 Jan &mdash; 15 Fev 2026</span>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card fade-in delay-1">
      <div class="kpi-label">Investimento Total</div>
      <div class="kpi-value" style="color: var(--accent);">R$ 1.261,63</div>
      <div class="kpi-sub"><span>Jan: R$ 983,47</span> &middot; <span>Fev: R$ 278,16</span></div>
    </div>
    <div class="kpi-card fade-in delay-2">
      <div class="kpi-label">Impress&otilde;es</div>
      <div class="kpi-value">29.389</div>
      <div class="kpi-sub"><span>CPM m&eacute;dio: R$ 42,93</span></div>
    </div>
    <div class="kpi-card fade-in delay-3">
      <div class="kpi-label">Alcance</div>
      <div class="kpi-value">8.526</div>
      <div class="kpi-sub"><span>Frequ&ecirc;ncia: 3,45</span></div>
    </div>
    <div class="kpi-card fade-in delay-4">
      <div class="kpi-label">Cliques</div>
      <div class="kpi-value">386</div>
      <div class="kpi-sub"><span>CTR: 1,31%</span> &middot; <span>CPC: R$ 3,27</span></div>
    </div>
    <div class="kpi-card fade-in delay-5">
      <div class="kpi-label">Conversas WhatsApp</div>
      <div class="kpi-value" style="color: var(--green);">171</div>
      <div class="kpi-sub"><span>Custo/conversa: R$ 7,38</span></div>
    </div>
    <div class="kpi-card fade-in delay-6">
      <div class="kpi-label">Video Views</div>
      <div class="kpi-value">3.649</div>
      <div class="kpi-sub"><span>Custo/view: R$ 0,35</span></div>
    </div>
  </div>

  <div class="section fade-in delay-3">
    <div class="section-title"><span class="dot"></span>Evolu&ccedil;&atilde;o Di&aacute;ria</div>
    <div class="chart-grid">
      <div class="chart-box full">
        <h3>Investimento Di&aacute;rio (R$)</h3>
        <div class="chart-wrapper"><canvas id="chartSpend"></canvas></div>
      </div>
      <div class="chart-box">
        <h3>Impress&otilde;es &amp; Alcance</h3>
        <div class="chart-wrapper"><canvas id="chartImpressions"></canvas></div>
      </div>
      <div class="chart-box">
        <h3>Conversas WhatsApp / dia</h3>
        <div class="chart-wrapper"><canvas id="chartConversations"></canvas></div>
      </div>
      <div class="chart-box">
        <h3>CTR % (Taxa de Clique)</h3>
        <div class="chart-wrapper"><canvas id="chartCTR"></canvas></div>
      </div>
      <div class="chart-box">
        <h3>CPC (R$)</h3>
        <div class="chart-wrapper"><canvas id="chartCPC"></canvas></div>
      </div>
    </div>
  </div>

  <div class="section fade-in delay-4">
    <div class="section-title"><span class="dot"></span>Comparativo Mensal</div>
    <div class="month-grid">
      <div class="month-card">
        <h3 style="color: var(--accent);">Janeiro 2026</h3>
        <div class="month-stat"><span class="month-stat-label">Investimento</span><span class="month-stat-value">R$ 983,47</span></div>
        <div class="month-stat"><span class="month-stat-label">Impress&otilde;es</span><span class="month-stat-value">22.275</span></div>
        <div class="month-stat"><span class="month-stat-label">Alcance</span><span class="month-stat-value">6.179</span></div>
        <div class="month-stat"><span class="month-stat-label">Cliques</span><span class="month-stat-value">320</span></div>
        <div class="month-stat"><span class="month-stat-label">CTR</span><span class="month-stat-value">1,44%</span></div>
        <div class="month-stat"><span class="month-stat-label">CPC</span><span class="month-stat-value">R$ 3,07</span></div>
        <div class="month-stat"><span class="month-stat-label">CPM</span><span class="month-stat-value">R$ 44,15</span></div>
        <div class="month-stat"><span class="month-stat-label">Frequ&ecirc;ncia</span><span class="month-stat-value">3,60</span></div>
        <div class="month-stat"><span class="month-stat-label">Conversas WPP</span><span class="month-stat-value" style="color: var(--green);">142</span></div>
        <div class="month-stat"><span class="month-stat-label">Custo/Conversa</span><span class="month-stat-value">R$ 6,93</span></div>
        <div class="month-stat"><span class="month-stat-label">Video Views</span><span class="month-stat-value">2.843</span></div>
        <div class="month-stat"><span class="month-stat-label">Link Clicks</span><span class="month-stat-value">129</span></div>
        <div class="month-stat"><span class="month-stat-label">First Reply</span><span class="month-stat-value">69</span></div>
        <div class="month-stat"><span class="month-stat-label">Rea&ccedil;&otilde;es</span><span class="month-stat-value">58</span></div>
      </div>
      <div class="month-card">
        <h3 style="color: var(--pink);">Fevereiro 2026 <span style="font-size:12px;color:var(--text-dim);font-weight:400">(at&eacute; dia 15)</span></h3>
        <div class="month-stat"><span class="month-stat-label">Investimento</span><span class="month-stat-value">R$ 278,16</span></div>
        <div class="month-stat"><span class="month-stat-label">Impress&otilde;es</span><span class="month-stat-value">7.114</span></div>
        <div class="month-stat"><span class="month-stat-label">Alcance</span><span class="month-stat-value">2.347</span></div>
        <div class="month-stat"><span class="month-stat-label">Cliques</span><span class="month-stat-value">66</span></div>
        <div class="month-stat"><span class="month-stat-label">CTR</span><span class="month-stat-value">0,93%</span></div>
        <div class="month-stat"><span class="month-stat-label">CPC</span><span class="month-stat-value">R$ 4,21</span></div>
        <div class="month-stat"><span class="month-stat-label">CPM</span><span class="month-stat-value">R$ 39,10</span></div>
        <div class="month-stat"><span class="month-stat-label">Frequ&ecirc;ncia</span><span class="month-stat-value">3,03</span></div>
        <div class="month-stat"><span class="month-stat-label">Conversas WPP</span><span class="month-stat-value" style="color: var(--green);">29</span></div>
        <div class="month-stat"><span class="month-stat-label">Custo/Conversa</span><span class="month-stat-value">R$ 9,59</span></div>
        <div class="month-stat"><span class="month-stat-label">Video Views</span><span class="month-stat-value">806</span></div>
        <div class="month-stat"><span class="month-stat-label">Link Clicks</span><span class="month-stat-value">27</span></div>
        <div class="month-stat"><span class="month-stat-label">First Reply</span><span class="month-stat-value">13</span></div>
        <div class="month-stat"><span class="month-stat-label">Rea&ccedil;&otilde;es</span><span class="month-stat-value">12</span></div>
      </div>
    </div>
  </div>

  <div class="section fade-in delay-5">
    <div class="section-title"><span class="dot"></span>Detalhamento por Campanha</div>
    <div class="table-wrap" style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th>Campanha</th>
            <th>Status</th>
            <th>Investido</th>
            <th>Impress&otilde;es</th>
            <th>Alcance</th>
            <th>Cliques</th>
            <th>CTR</th>
            <th>CPC</th>
            <th>CPM</th>
            <th>Freq.</th>
            <th>Conversas</th>
            <th>Custo/Conv.</th>
            <th>Views</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="campaign-name">[RS] [ENGAJAMENTO] [WHATSAPP] - 24/10/2025</td>
            <td><span class="status status-active">Ativa</span></td>
            <td class="metric-highlight">R$ 638,59</td>
            <td>13.495</td>
            <td>5.286</td>
            <td>244</td>
            <td>1,81%</td>
            <td>R$ 2,62</td>
            <td>R$ 47,32</td>
            <td>2,55</td>
            <td style="color: var(--green); font-weight: 700;">106</td>
            <td>R$ 6,02</td>
            <td>1.973</td>
          </tr>
          <tr>
            <td class="campaign-name">[RS] [ENGAJAMENTO] [WHATSAPP] - 31/10/2025 - teste criativo</td>
            <td><span class="status status-active">Ativa</span></td>
            <td class="metric-highlight">R$ 623,04</td>
            <td>15.894</td>
            <td>3.564</td>
            <td>142</td>
            <td>0,89%</td>
            <td>R$ 4,39</td>
            <td>R$ 39,20</td>
            <td>4,46</td>
            <td style="color: var(--green); font-weight: 700;">65</td>
            <td>R$ 9,59</td>
            <td>1.676</td>
          </tr>
          <tr>
            <td class="campaign-name">[RS] [ENGAJAMENTO] [WHATSAPP] - CBO 15/07/25</td>
            <td><span class="status status-paused">Pausada</span></td>
            <td class="metric-highlight" style="color: var(--text-dim);">&mdash;</td>
            <td colspan="10" style="color: var(--text-dim);">Sem dados em 2026</td>
          </tr>
          <tr>
            <td class="campaign-name">[ENGAJAMENTO][WHATSAPP][JUNHO] - SUBIDO</td>
            <td><span class="status status-paused">Pausada</span></td>
            <td class="metric-highlight" style="color: var(--text-dim);">&mdash;</td>
            <td colspan="10" style="color: var(--text-dim);">Sem dados em 2026</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="section fade-in delay-6">
    <div class="section-title"><span class="dot"></span>Comparativo entre Campanhas Ativas</div>
    <div class="chart-grid">
      <div class="chart-box">
        <h3>Investimento x Conversas</h3>
        <div class="chart-wrapper"><canvas id="chartCampaignCompare"></canvas></div>
      </div>
      <div class="chart-box">
        <h3>Efici&ecirc;ncia (CPC, Custo/Conversa)</h3>
        <div class="chart-wrapper"><canvas id="chartEfficiency"></canvas></div>
      </div>
    </div>
  </div>

  <div class="section fade-in delay-6">
    <div class="section-title"><span class="dot"></span>Insights &amp; Observa&ccedil;&otilde;es</div>
    <div class="insights-grid">
      <div class="month-card" style="border-left: 3px solid var(--green);">
        <h3 style="font-size: 15px; color: var(--green); margin-bottom: 12px;">Campanha 24/10 (Melhor performance)</h3>
        <p style="color: var(--text-dim); font-size: 14px; line-height: 1.6;">
          CPC 40% menor (R$ 2,62 vs R$ 4,39). CTR 2x maior (1,81% vs 0,89%). Custo/conversa 37% mais barato (R$ 6,02 vs R$ 9,59). Frequ&ecirc;ncia saud&aacute;vel em 2,55.
        </p>
      </div>
      <div class="month-card" style="border-left: 3px solid var(--amber);">
        <h3 style="font-size: 15px; color: var(--amber); margin-bottom: 12px;">Campanha 31/10 (Teste Criativo)</h3>
        <p style="color: var(--text-dim); font-size: 14px; line-height: 1.6;">
          Frequ&ecirc;ncia alta (4,46) indica satura&ccedil;&atilde;o do p&uacute;blico. CPM mais baixo (R$ 39,20), mas convers&atilde;o inferior. Sugest&atilde;o: expandir p&uacute;blico ou pausar para renovar criativos.
        </p>
      </div>
      <div class="month-card insights-full" style="border-left: 3px solid var(--cyan);">
        <h3 style="font-size: 15px; color: var(--cyan); margin-bottom: 12px;">Tend&ecirc;ncias Gerais</h3>
        <p style="color: var(--text-dim); font-size: 14px; line-height: 1.6;">
          Fevereiro mostra queda de performance vs Janeiro: CTR caiu de 1,44% para 0,93%, e custo/conversa subiu 38% (R$ 6,93 &rarr; R$ 9,59).
          Houve gap de veicula&ccedil;&atilde;o entre 02-07/Fev. Total de 171 conversas no WhatsApp com custo m&eacute;dio de R$ 7,38.
          82 primeiras respostas registradas (first reply) indicam boa taxa de engajamento nas conversas.
        </p>
      </div>
    </div>
  </div>

  <div class="footer">
    Gerado automaticamente via Meta Graph API &mdash; Dados de 01/01/2026 a 15/02/2026
  </div>

</div>

<script>
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#8888a8',
        font: { family: 'Space Mono', size: 11 },
        boxWidth: 12,
        padding: 16,
      }
    },
    tooltip: {
      backgroundColor: '#1a1a27',
      borderColor: '#2a2a3d',
      borderWidth: 1,
      titleFont: { family: 'Outfit', size: 13, weight: '600' },
      bodyFont: { family: 'Space Mono', size: 12 },
      titleColor: '#e8e8f0',
      bodyColor: '#8888a8',
      padding: 12,
      cornerRadius: 8,
    }
  },
  scales: {
    x: {
      grid: { color: '#1a1a2711' },
      ticks: { color: '#8888a8', font: { family: 'Space Mono', size: 10 }, maxRotation: 45 }
    },
    y: {
      grid: { color: '#2a2a3d44' },
      ticks: { color: '#8888a8', font: { family: 'Space Mono', size: 10 } }
    }
  }
};

const days = ['05/01','06/01','07/01','08/01','09/01','10/01','11/01','12/01','13/01','14/01','15/01','16/01','17/01','18/01','19/01','20/01','21/01','22/01','23/01','24/01','25/01','26/01','27/01','28/01','29/01','30/01','31/01','01/02','02/02','08/02','09/02','10/02','11/02','12/02','13/02','14/02','15/02'];
const spend = [35.17,47.25,49.81,43.17,35.61,30.38,17.76,59.79,52.77,30.39,36.11,31.28,27.92,33.60,54.11,38.71,29.77,31.69,33.06,21.97,44.05,44.78,42.99,29.91,25.57,31.32,24.53,32.36,0,0.85,52.70,47.36,43.85,35.59,25.66,21.20,18.59];
const impressions = [1215,1616,1172,941,919,722,552,1413,908,606,767,716,656,754,1081,691,601,592,659,419,677,800,772,695,827,775,729,782,0,44,1465,1057,989,814,755,642,566];
const reach = [873,1034,786,552,539,430,234,849,521,322,389,375,319,316,494,392,281,285,298,194,269,277,295,257,259,291,373,355,0,28,624,494,425,367,457,401,284];
const clicks = [21,22,14,16,16,15,4,16,10,4,8,16,5,12,14,18,13,6,11,5,13,7,13,10,11,11,9,9,0,0,16,11,6,9,6,5,4];
const conversations = [3,5,4,4,4,5,3,6,10,4,7,5,2,3,8,5,8,2,7,3,8,4,12,7,4,6,3,1,3,0,7,5,3,3,1,5,1];
const ctr = [1.73,1.36,1.19,1.70,1.74,2.08,0.72,1.13,1.10,0.66,1.04,2.23,0.76,1.59,1.30,2.60,2.16,1.01,1.67,1.19,1.92,0.88,1.68,1.44,1.33,1.42,1.23,1.15,0,0,1.09,1.04,0.61,1.11,0.79,0.78,0.71];
const cpc = [1.67,2.15,3.56,2.70,2.23,2.03,4.44,3.74,5.28,7.60,4.51,1.96,5.58,2.80,3.87,2.15,2.29,5.28,3.01,4.39,3.39,6.40,3.31,2.99,2.32,2.85,2.73,3.60,0,0,3.29,4.31,7.31,3.95,4.28,4.24,4.65];

new Chart(document.getElementById('chartSpend'), {
  type: 'bar',
  data: {
    labels: days,
    datasets: [{
      label: 'Investimento (R$)',
      data: spend,
      backgroundColor: spend.map((v, i) => i < 27 ? '#6c5ce788' : '#ec489988'),
      borderColor: spend.map((v, i) => i < 27 ? '#6c5ce7' : '#ec4899'),
      borderWidth: 1,
      borderRadius: 4,
    }]
  },
  options: { ...chartDefaults }
});

new Chart(document.getElementById('chartImpressions'), {
  type: 'line',
  data: {
    labels: days,
    datasets: [
      { label: 'Impressoes', data: impressions, borderColor: '#6c5ce7', backgroundColor: '#6c5ce722', fill: true, tension: 0.4, pointRadius: 2 },
      { label: 'Alcance', data: reach, borderColor: '#18ffff', backgroundColor: '#18ffff11', fill: true, tension: 0.4, pointRadius: 2 }
    ]
  },
  options: { ...chartDefaults }
});

new Chart(document.getElementById('chartConversations'), {
  type: 'bar',
  data: {
    labels: days,
    datasets: [{
      label: 'Conversas WPP',
      data: conversations,
      backgroundColor: '#00e67666',
      borderColor: '#00e676',
      borderWidth: 1,
      borderRadius: 4,
    }]
  },
  options: { ...chartDefaults }
});

new Chart(document.getElementById('chartCTR'), {
  type: 'line',
  data: {
    labels: days,
    datasets: [{
      label: 'CTR %',
      data: ctr,
      borderColor: '#ffab40',
      backgroundColor: '#ffab4022',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
    }]
  },
  options: { ...chartDefaults }
});

new Chart(document.getElementById('chartCPC'), {
  type: 'line',
  data: {
    labels: days,
    datasets: [{
      label: 'CPC (R$)',
      data: cpc,
      borderColor: '#ff5252',
      backgroundColor: '#ff525222',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
    }]
  },
  options: { ...chartDefaults }
});

new Chart(document.getElementById('chartCampaignCompare'), {
  type: 'bar',
  data: {
    labels: ['Campanha 24/10', 'Teste Criativo 31/10'],
    datasets: [
      { label: 'Investido (R$)', data: [638.59, 623.04], backgroundColor: '#6c5ce7aa', borderColor: '#6c5ce7', borderWidth: 1, borderRadius: 6 },
      { label: 'Conversas', data: [106, 65], backgroundColor: '#00e676aa', borderColor: '#00e676', borderWidth: 1, borderRadius: 6 }
    ]
  },
  options: { ...chartDefaults, indexAxis: 'y' }
});

new Chart(document.getElementById('chartEfficiency'), {
  type: 'bar',
  data: {
    labels: ['CPC (R$)', 'Custo/Conversa (R$)', 'CTR (%)', 'Frequencia'],
    datasets: [
      { label: 'Campanha 24/10', data: [2.62, 6.02, 1.81, 2.55], backgroundColor: '#6c5ce7aa', borderColor: '#6c5ce7', borderWidth: 1, borderRadius: 6 },
      { label: 'Teste Criativo 31/10', data: [4.39, 9.59, 0.89, 4.46], backgroundColor: '#ec4899aa', borderColor: '#ec4899', borderWidth: 1, borderRadius: 6 }
    ]
  },
  options: { ...chartDefaults }
});
</script>
</body>
</html>`;

export async function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
