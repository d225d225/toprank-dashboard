/* TopRank Trading Dashboard — app.js */

'use strict';

// ── Config ────────────────────────────────────────────────────────────────────

const DATA_URL = 'data/latest_report.json';

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtCurrency(v, decimals = 2) {
  if (v == null) return 'N/A';
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtPct(v, decimals = 2, multiply = false) {
  if (v == null) return 'N/A';
  const pct = multiply ? v * 100 : v;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
}

function fmtShares(n) {
  return Number(n).toLocaleString('en-US');
}

function fmtDate(s) {
  const parts = s.split('-');
  if (parts.length !== 3) return s;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function pnlClass(v) {
  if (v == null) return 'neutral';
  return v >= 0 ? 'positive' : 'negative';
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

let navChart = null;

function buildNavChart(navHistory, showQQQ, showSPY, qqqData, spyData) {
  const sorted = [...navHistory].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map(h => h.date);
  const navValues = sorted.map(h => h.nav);

  const datasets = [
    {
      label: 'Portfolio NAV',
      data: navValues,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.08)',
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    },
  ];

  if (showQQQ && qqqData.length) {
    datasets.push({
      label: 'QQQ',
      data: qqqData,
      borderColor: '#f59e0b',
      borderWidth: 1.5,
      borderDash: [4, 3],
      fill: false,
      tension: 0.3,
      pointRadius: 0,
    });
  }

  if (showSPY && spyData.length) {
    datasets.push({
      label: 'SPY',
      data: spyData,
      borderColor: '#22c55e',
      borderWidth: 1.5,
      borderDash: [4, 3],
      fill: false,
      tension: 0.3,
      pointRadius: 0,
    });
  }

  const ctx = document.getElementById('navChart').getContext('2d');

  if (navChart) navChart.destroy();

  navChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8892a4', font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${fmtCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#8892a4', maxTicksLimit: 8 },
          grid:  { color: 'rgba(46,50,80,0.6)' },
        },
        y: {
          ticks: { color: '#8892a4', callback: v => fmtCurrency(v, 0) },
          grid:  { color: 'rgba(46,50,80,0.6)' },
        },
      },
    },
  });
}

let drawdownChart = null;

function buildDrawdownChart(drawdownPct) {
  const ctx = document.getElementById('drawdownChart').getContext('2d');
  if (drawdownChart) drawdownChart.destroy();

  const pct = (drawdownPct * 100).toFixed(2);
  const remaining = (100 - pct).toFixed(2);

  drawdownChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Drawdown', 'Remaining'],
      datasets: [{
        data: [pct, remaining],
        backgroundColor: ['#ef4444', 'rgba(46,50,80,0.4)'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(2)}%` } },
      },
    },
  });
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }

function setText(id, text) { const e = el(id); if (e) e.textContent = text; }

function setClass(id, cls) { const e = el(id); if (e) e.className = cls; }

// ── Render functions ──────────────────────────────────────────────────────────

function renderKPIs(report) {
  setText('kpi-nav',          fmtCurrency(report.nav));
  setText('kpi-cash',         fmtCurrency(report.cash));
  setText('kpi-invested',     fmtCurrency(report.invested_value));
  setText('kpi-cash-pct',     fmtPct(report.cash_pct, 1, true));

  const dpnl = report.daily_pnl;
  const dpct = report.daily_pnl_pct;
  setText('kpi-daily-pnl', `${fmtCurrency(dpnl)} (${fmtPct(dpct, 2, true)})`);
  setClass('kpi-daily-pnl', pnlClass(dpnl));

  const dd = report.max_drawdown_pct;
  setText('kpi-drawdown', fmtPct(dd, 2, true));
  setClass('kpi-drawdown', dd > 0.05 ? 'negative' : 'neutral');

  setText('kpi-date', fmtDate(report.report_date));
}

function renderBenchmark(bm) {
  setText('bm-qqq-1d',  fmtPct(bm.qqq_1d_pct,  2, true));
  setText('bm-spy-1d',  fmtPct(bm.spy_1d_pct,  2, true));
  setText('bm-qqq-ytd', fmtPct(bm.qqq_ytd_pct, 2, true));
  setText('bm-spy-ytd', fmtPct(bm.spy_ytd_pct, 2, true));
  setClass('bm-qqq-1d',  pnlClass(bm.qqq_1d_pct));
  setClass('bm-spy-1d',  pnlClass(bm.spy_1d_pct));
}

function renderHoldings(holdings) {
  const tbody = el('holdings-body');
  if (!tbody) return;

  if (!holdings.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No open positions</td></tr>';
    return;
  }

  const sorted = [...holdings].sort((a, b) => b.weight_pct - a.weight_pct);

  tbody.innerHTML = sorted.map(h => {
    const wt = fmtPct(h.weight_pct, 1, true);
    const pe = h.pe_ratio != null ? h.pe_ratio.toFixed(1) : '—';
    return `
      <tr>
        <td><strong>${h.symbol}</strong></td>
        <td>${fmtShares(h.shares)}</td>
        <td>${fmtCurrency(h.current_price)}</td>
        <td>${fmtCurrency(h.market_value, 0)}</td>
        <td class="${pnlClass(h.unrealized_pl)}">${fmtCurrency(h.unrealized_pl, 0)} (${fmtPct(h.unrealized_plpc, 2, true)})</td>
        <td class="${pnlClass(h.pnl_1d_pct)}">${fmtPct(h.pnl_1d_pct, 2, true)}</td>
        <td class="${pnlClass(h.pnl_1w_pct)}">${fmtPct(h.pnl_1w_pct, 2, true)}</td>
        <td class="${pnlClass(h.pnl_1m_pct)}">${fmtPct(h.pnl_1m_pct, 2, true)}</td>
        <td>${pe}</td>
      </tr>`;
  }).join('');
}

function renderTop10(top10) {
  const tbody = el('top10-body');
  if (!tbody) return;

  if (!top10.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No ranked stocks today</td></tr>';
    return;
  }

  tbody.innerHTML = top10.map((item, i) => {
    const badgeClass = i < 3 ? 'rank-badge top3' : 'rank-badge';
    const score = item.score != null ? item.score.toFixed(1) : '—';
    return `
      <tr>
        <td><span class="${badgeClass}">${item.rank ?? i + 1}</span></td>
        <td><strong>${item.symbol}</strong></td>
        <td>${score}</td>
      </tr>`;
  }).join('');
}

function renderWatchlist(categories) {
  const container = el('watchlist-container');
  if (!container) return;

  const entries = Object.entries(categories);
  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">No watchlist categories defined in strategy.</p>';
    return;
  }

  container.innerHTML = entries.map(([name, symbols]) => {
    const list = Array.isArray(symbols)
      ? symbols.map(s => `<li>${s}</li>`).join('')
      : '<li class="neutral">—</li>';
    return `
      <div class="watchlist-cat">
        <h3>${name}</h3>
        <ul>${list}</ul>
      </div>`;
  }).join('');
}

function renderTrades(trades) {
  const tbody = el('trades-body');
  if (!tbody) return;

  if (!trades.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No trades today</td></tr>';
    return;
  }

  tbody.innerHTML = trades.map(t => {
    const actionClass = t.action === 'BUY' ? 'positive' : 'negative';
    return `
      <tr>
        <td><strong>${t.symbol}</strong></td>
        <td class="${actionClass}">${t.action}</td>
        <td>${fmtShares(t.shares)}</td>
        <td>${fmtCurrency(t.price)}</td>
        <td>${fmtCurrency(t.value, 0)}</td>
      </tr>`;
  }).join('');
}

// ── Main ──────────────────────────────────────────────────────────────────────

let reportData = null;
let showQQQ = false;
let showSPY = false;

async function loadReport() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    reportData = await res.json();
    renderAll(reportData);
  } catch (err) {
    console.error('Failed to load report:', err);
    const main = document.querySelector('main');
    if (main) {
      main.innerHTML = `<div class="card loading">
        <p>Unable to load report data.</p>
        <p style="font-size:0.8rem;margin-top:0.5rem;color:#8892a4">${err.message}</p>
      </div>`;
    }
  }
}

function renderAll(report) {
  renderKPIs(report);
  renderBenchmark(report.benchmark || {});
  renderHoldings(report.holdings || []);
  renderTop10(report.top10_ranked || []);
  renderWatchlist(report.watchlist_categories || {});
  renderTrades(report.trades_today || []);
  buildNavChart(report.nav_history || [], showQQQ, showSPY, [], []);
  buildDrawdownChart(report.max_drawdown_pct || 0);
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadReport();

  const btnQQQ = el('toggle-qqq');
  const btnSPY  = el('toggle-spy');

  if (btnQQQ) btnQQQ.addEventListener('click', () => {
    showQQQ = !showQQQ;
    btnQQQ.classList.toggle('active', showQQQ);
    if (reportData) buildNavChart(reportData.nav_history || [], showQQQ, showSPY, [], []);
  });

  if (btnSPY) btnSPY.addEventListener('click', () => {
    showSPY = !showSPY;
    btnSPY.classList.toggle('active', showSPY);
    if (reportData) buildNavChart(reportData.nav_history || [], showQQQ, showSPY, [], []);
  });
});
