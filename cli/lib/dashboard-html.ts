/**
 * @module cli/lib/dashboard-html
 * @description Generate a self-contained HTML dashboard with inline SVG charts.
 * No external dependencies — opens directly in any browser.
 */

// ── Types ──

export interface DashboardData {
  channelTitle: string;
  dateRange: { start: string; end: string };
  generatedAt: string;

  // KPI cards
  kpis: Array<{
    label: string;
    value: string;
    change?: string; // e.g. "+12.3%"
    trend?: 'up' | 'down' | 'flat';
  }>;

  // Daily trends line chart
  dailyTrends?: {
    dates: string[];
    views: number[];
    watchMinutes: number[];
    subscribers: number[];
  };

  // Top videos table
  topVideos?: Array<{
    rank: number;
    title: string;
    videoId: string;
    views: number;
    watchTimeHours: number;
    avgDuration: string;
    ctr: string;
    likes: number;
  }>;

  // Traffic sources pie
  trafficSources?: Array<{
    source: string;
    views: number;
    percent: number;
  }>;

  // Demographics bar chart
  demographics?: Array<{
    group: string;
    male: number;
    female: number;
  }>;

  // Top search keywords
  keywords?: Array<{
    keyword: string;
    views: number;
    watchMinutes: number;
  }>;

  // Device distribution
  devices?: Array<{
    device: string;
    views: number;
    percent: number;
  }>;

  // Country distribution
  countries?: Array<{
    country: string;
    views: number;
    watchMinutes: number;
  }>;
}

// ── SVG Chart Generators ──

function lineChart(
  data: { dates: string[]; series: Array<{ name: string; values: number[]; color: string }> },
  width = 800,
  height = 300,
): string {
  const padL = 60, padR = 20, padT = 30, padB = 50;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  // Find global max across all series
  const allValues = data.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 1);
  const minVal = 0;
  const len = data.dates.length;

  const xScale = (i: number) => padL + (i / Math.max(len - 1, 1)) * chartW;
  const yScale = (v: number) => padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

  // Grid lines
  const gridLines: string[] = [];
  const gridCount = 5;
  for (let i = 0; i <= gridCount; i++) {
    const y = padT + (i / gridCount) * chartH;
    const val = maxVal - (i / gridCount) * (maxVal - minVal);
    gridLines.push(
      `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`,
      `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="11">${formatChartNum(val)}</text>`,
    );
  }

  // X-axis labels (show ~8 labels max)
  const labelStep = Math.max(1, Math.floor(len / 8));
  const xLabels: string[] = [];
  data.dates.forEach((d, i) => {
    if (i % labelStep === 0 || i === len - 1) {
      xLabels.push(
        `<text x="${xScale(i)}" y="${height - 8}" text-anchor="middle" fill="#94a3b8" font-size="10" transform="rotate(-30 ${xScale(i)} ${height - 8})">${d.slice(5)}</text>`
      );
    }
  });

  // Series paths
  const paths = data.series.map((s) => {
    const points = s.values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');
    return `
      <polyline fill="none" stroke="${s.color}" stroke-width="2" points="${points}" stroke-linejoin="round"/>
      <text x="${xScale(len - 1) + 6}" y="${yScale(s.values[s.values.length - 1]) + 4}" fill="${s.color}" font-size="11">${s.name}</text>
    `;
  });

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${width}px">
    ${gridLines.join('')}
    ${xLabels.join('')}
    ${paths.join('')}
  </svg>`;
}

function barChart(
  data: Array<{ label: string; value: number; color?: string }>,
  width = 600,
  height = 250,
): string {
  const padL = 120, padR = 20, padT = 20, padB = 20;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barH = Math.max(8, Math.min(30, (chartH - data.length * 4) / data.length));

  const bars = data.map((d, i) => {
    const y = padT + i * (barH + 6);
    const w = (d.value / maxVal) * chartW;
    const color = d.color ?? '#6366f1';
    return `
      <text x="${padL - 8}" y="${y + barH / 2 + 4}" text-anchor="end" fill="#475569" font-size="12">${truncate(d.label, 16)}</text>
      <rect x="${padL}" y="${y}" width="${w}" height="${barH}" rx="3" fill="${color}" opacity="0.85"/>
      <text x="${padL + w + 6}" y="${y + barH / 2 + 4}" fill="#64748b" font-size="11">${formatChartNum(d.value)}</text>
    `;
  });

  const totalH = padT + data.length * (barH + 6) + padB;
  return `<svg viewBox="0 0 ${width} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${width}px">
    ${bars.join('')}
  </svg>`;
}

function donutChart(
  data: Array<{ label: string; value: number; color: string }>,
  size = 260,
): string {
  const cx = size / 2, cy = size / 2, r = size * 0.35, inner = size * 0.2;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let cumAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const angle = Math.min((d.value / total) * Math.PI * 2, Math.PI * 2 - 0.001);
    const startAngle = cumAngle;
    cumAngle += (d.value / total) * Math.PI * 2;
    const endAngle = startAngle + angle;

    const x1o = cx + r * Math.cos(startAngle);
    const y1o = cy + r * Math.sin(startAngle);
    const x2o = cx + r * Math.cos(endAngle);
    const y2o = cy + r * Math.sin(endAngle);
    const x1i = cx + inner * Math.cos(endAngle);
    const y1i = cy + inner * Math.sin(endAngle);
    const x2i = cx + inner * Math.cos(startAngle);
    const y2i = cy + inner * Math.sin(startAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    return `<path d="M${x1o},${y1o} A${r},${r} 0 ${largeArc} 1 ${x2o},${y2o} L${x1i},${y1i} A${inner},${inner} 0 ${largeArc} 0 ${x2i},${y2i} Z" fill="${d.color}"/>`;
  });

  const legend = data.map((d, i) => {
    const pct = ((d.value / total) * 100).toFixed(1);
    return `<div style="display:flex;align-items:center;gap:6px;font-size:13px">
      <span style="width:12px;height:12px;border-radius:2px;background:${d.color};flex-shrink:0"></span>
      <span style="color:#475569">${truncate(d.label, 20)}</span>
      <span style="color:#94a3b8;margin-left:auto">${pct}%</span>
    </div>`;
  });

  return `<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
    <svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="width:${size}px;height:${size}px;flex-shrink:0">
      ${slices.join('')}
    </svg>
    <div style="display:flex;flex-direction:column;gap:6px">${legend.join('')}</div>
  </div>`;
}

// ── HTML Template ──

export function generateDashboardHTML(data: DashboardData): string {
  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  // KPI cards
  const kpiCards = data.kpis.map((kpi) => {
    const trendColor = kpi.trend === 'up' ? '#10b981' : kpi.trend === 'down' ? '#ef4444' : '#94a3b8';
    const trendIcon = kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→';
    return `<div class="kpi-card">
      <div class="kpi-label">${esc(kpi.label)}</div>
      <div class="kpi-value">${esc(kpi.value)}</div>
      ${kpi.change ? `<div class="kpi-change" style="color:${trendColor}">${trendIcon} ${esc(kpi.change)}</div>` : ''}
    </div>`;
  });

  // Daily trends chart
  let trendsSection = '';
  if (data.dailyTrends) {
    const t = data.dailyTrends;
    trendsSection = `
      <div class="section">
        <h2>📈 Daily Trends</h2>
        <div class="chart-tabs">
          <div class="chart-container">${lineChart({
            dates: t.dates,
            series: [
              { name: 'Views', values: t.views, color: '#6366f1' },
              { name: 'Watch min', values: t.watchMinutes, color: '#f59e0b' },
            ],
          })}</div>
          <div class="chart-container" style="margin-top:16px">${lineChart({
            dates: t.dates,
            series: [
              { name: 'Subs ±', values: t.subscribers, color: '#10b981' },
            ],
          }, 800, 200)}</div>
        </div>
      </div>`;
  }

  // Top videos table
  let videosSection = '';
  if (data.topVideos?.length) {
    const rows = data.topVideos.map((v) => `
      <tr>
        <td>${v.rank}</td>
        <td class="video-title"><a href="https://youtube.com/watch?v=${esc(v.videoId)}" target="_blank">${esc(truncate(v.title, 50))}</a></td>
        <td class="num">${formatChartNum(v.views)}</td>
        <td class="num">${v.watchTimeHours.toFixed(1)}h</td>
        <td class="num">${esc(v.avgDuration)}</td>
        <td class="num">${esc(v.ctr)}</td>
        <td class="num">${formatChartNum(v.likes)}</td>
      </tr>`);

    videosSection = `
      <div class="section">
        <h2>🏆 Top Videos</h2>
        <div style="overflow-x:auto">
          <table>
            <thead><tr><th>#</th><th>Title</th><th>Views</th><th>Watch Time</th><th>Avg Duration</th><th>CTR</th><th>Likes</th></tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>
      </div>`;
  }

  // Traffic sources
  let trafficSection = '';
  if (data.trafficSources?.length) {
    trafficSection = `
      <div class="section">
        <h2>🔗 Traffic Sources</h2>
        ${donutChart(data.trafficSources.map((s, i) => ({
          label: s.source,
          value: s.views,
          color: COLORS[i % COLORS.length],
        })))}
      </div>`;
  }

  // Demographics
  let demoSection = '';
  if (data.demographics?.length) {
    const maleData = data.demographics.map((d) => ({ label: d.group, value: d.male, color: '#6366f1' }));
    const femaleData = data.demographics.map((d) => ({ label: d.group, value: d.female, color: '#ec4899' }));
    demoSection = `
      <div class="section">
        <h2>👥 Demographics</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div><h3 style="color:#6366f1;font-size:14px">Male</h3>${barChart(maleData, 400, 200)}</div>
          <div><h3 style="color:#ec4899;font-size:14px">Female</h3>${barChart(femaleData, 400, 200)}</div>
        </div>
      </div>`;
  }

  // Keywords
  let keywordsSection = '';
  if (data.keywords?.length) {
    keywordsSection = `
      <div class="section">
        <h2>🔍 Top Search Keywords</h2>
        ${barChart(data.keywords.map((k) => ({ label: k.keyword, value: k.views, color: '#8b5cf6' })), 700, Math.max(200, data.keywords.length * 36))}
      </div>`;
  }

  // Devices
  let devicesSection = '';
  if (data.devices?.length) {
    devicesSection = `
      <div class="section">
        <h2>📱 Device Distribution</h2>
        ${donutChart(data.devices.map((d, i) => ({
          label: d.device,
          value: d.views,
          color: COLORS[i % COLORS.length],
        })))}
      </div>`;
  }

  // Countries
  let countriesSection = '';
  if (data.countries?.length) {
    countriesSection = `
      <div class="section">
        <h2>🌍 Top Countries</h2>
        ${barChart(data.countries.map((c) => ({ label: c.country, value: c.views, color: '#06b6d4' })), 700, Math.max(200, data.countries.length * 36))}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(data.channelTitle)} — YouTube Analytics Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.5; }
    .container { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
    header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 24px; flex-wrap: wrap; gap: 8px; }
    header h1 { font-size: 24px; font-weight: 700; }
    header .meta { color: #64748b; font-size: 13px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .kpi-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .kpi-label { font-size: 13px; color: #64748b; margin-bottom: 4px; }
    .kpi-value { font-size: 28px; font-weight: 700; color: #1e293b; }
    .kpi-change { font-size: 13px; font-weight: 600; margin-top: 4px; }
    .section { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 24px; }
    .section h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .chart-container { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    tr:hover { background: #f8fafc; }
    a { color: #6366f1; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .video-title { max-width: 300px; }
    footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 32px; padding: 16px; }
    @media (max-width: 768px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .section h2 { font-size: 16px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 ${esc(data.channelTitle)}</h1>
      <div class="meta">${esc(data.dateRange.start)} → ${esc(data.dateRange.end)} · Generated ${esc(data.generatedAt)}</div>
    </header>
    <div class="kpi-grid">${kpiCards.join('')}</div>
    ${trendsSection}
    ${videosSection}
    ${trafficSection}
    ${demoSection}
    ${keywordsSection}
    ${devicesSection}
    ${countriesSection}
    <footer>Generated by ARS — Agentic Remotion Studio</footer>
  </div>
</body>
</html>`;
}

// ── Utilities ──

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function formatChartNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}
