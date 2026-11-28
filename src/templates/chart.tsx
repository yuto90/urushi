import type { Chart, Slide } from '../schema/index.js';

type Milestone = Extract<Slide, { type: 'chart' }>;

function BarPlot({ chart, slide }: { chart: Exclude<Chart, { kind: 'flow' }>; slide: Milestone }) {
  const left = 65;
  const width = 1120;
  const baseline = 506;
  const peak = Math.max(1, ...chart.bars.map((bar) => bar.value));
  const step = width / chart.bars.length;
  const x = (i: number) => left + step * (i + 0.5);
  const y = (value: number) => baseline - 340 * value / peak;
  const detail = chart.breakdown;
  const anchor = chart.bars.findIndex((bar) => bar.label === detail?.bar);
  const anchorX = x(anchor);
  const anchorY = y(chart.bars[anchor]?.value ?? 0);
  return <svg viewBox="0 0 1760 675" role="img" aria-label={`棒グラフ（${chart.unit}）`}>
          <text x={left} y="72" class="chart-unit">{chart.unit}</text>
          {[0, 1, 2, 3, 4].map((tick) =>
            <line x1={left} x2={left + width} y1={baseline - tick * 85} y2={baseline - tick * 85} class="chart-grid"/>)}
          {chart.bars.map((bar, i) => <g class="chart-bar" data-label={bar.label} data-value={bar.value}
              opacity={!slide.highlight?.length || slide.highlight.includes(bar.label) ? 1 : 0.28}>
            <rect x={x(i) - step * 0.28} y={y(bar.value)} width={step * 0.56} height={baseline - y(bar.value)} rx="5"/>
            <text x={x(i)} y={y(bar.value) - 16} text-anchor="middle">{bar.value}</text>
            <text x={x(i)} y={baseline + 48} text-anchor="middle" class="chart-label">{bar.label}</text>
          </g>)}
          {detail && <g class="chart-detail" opacity={slide.showBreakdown ? 1 : 0}>
            <path class="chart-leader" d={`M${anchorX},${anchorY - 54} V106 H1300`} pathLength="1" />
            <g class="chart-breakdown" data-travel={1300 - anchorX}>
              <rect x="1290" y="88" width="447" height={112 + detail.items.length * 75} rx="18"/>
              <text x="1324" y="147" class="breakdown-title">{detail.bar}の内訳</text>
              {detail.items.map((item, i) => <g>
                <text x="1324" y={229 + 75 * i}>{item.label}</text>
                <text x="1698" y={229 + 75 * i} text-anchor="end" class="breakdown-value">{item.value}</text>
              </g>)}
            </g>
          </g>}
        </svg>;
}

function FlowPlot({ chart, slide }: { chart: Extract<Chart, { kind: 'flow' }>; slide: Milestone }) {
  return <div class="flow-plot" role="group" aria-label="工程図">{chart.nodes.map((node, i) =>
    <div class="flow-node" data-label={node.label} style={{ opacity: !slide.highlight?.length || slide.highlight.includes(node.label) ? 1 : 0.28 }}>
      <strong>{node.label}</strong>{node.description && <p>{node.description}</p>}
      {i < chart.nodes.length - 1 && <span aria-hidden="true">→</span>}
    </div>)}</div>;
}

export function ChartSlide({ chart, slide, index }: { chart: Chart; slide: Milestone; index: number }) {
  return <div class="slide-inner chart-page">
    <header class="chart-header"><span>{slide.title}</span><span>{String(index + 1).padStart(2, '0')}</span></header>
    <div class="chart-host" data-chart-state={JSON.stringify(slide)}>
      <div class="shared-chart" data-chart-id={chart.id}>
        <h1 class="chart-headline" data-check-text data-check-path="headline">{slide.headline}</h1>
        {chart.kind === 'flow' ? <FlowPlot chart={chart} slide={slide}/> : <BarPlot chart={chart} slide={slide}/>}
        <div class="chart-annotation" data-check-text data-check-path="annotation" style={{opacity: slide.annotation ? 1 : 0}}>{slide.annotation}</div>
      </div>
    </div>
  </div>;
}

export const chartCss = `
.chart-header {display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--urushi-color-line);padding-bottom:24px;color:var(--urushi-color-accent-strong);font-size:29px;font-weight:650}
.flow-plot {height:675px;display:flex;gap:52px;align-items:center}
.flow-node {position:relative;flex:1;min-width:0;padding:32px 28px;border:2px solid var(--urushi-color-line);border-radius:14px;background:var(--urushi-color-panel);font-size:28px}
.flow-node strong {color:var(--urushi-color-accent-strong);font-size:33px}
.flow-node p {color:var(--urushi-color-muted);line-height:1.45}
.flow-node span {position:absolute;right:-44px;top:50%;transform:translateY(-50%);color:var(--urushi-color-accent)}
.chart-host {margin-top:44px}
.chart-headline {margin:0;min-height:85px;font:600 65px/1.25 var(--urushi-font-serif);letter-spacing:.015em}
.shared-chart svg {width:100%;display:block;overflow:visible}
.chart-grid {stroke:var(--urushi-color-line);stroke-width:2}
.shared-chart svg text {fill:var(--urushi-color-text);font:500 31px var(--urushi-font-sans)}
.shared-chart svg .chart-unit,.shared-chart svg .chart-label {fill:var(--urushi-color-muted);font-size:25px}
.chart-bar rect {fill:var(--urushi-color-accent)}
.chart-leader {fill:none;stroke:var(--urushi-color-cool);stroke-width:3;stroke-dasharray:1}
.chart-breakdown rect {fill:var(--urushi-color-panel);stroke:var(--urushi-color-line);stroke-width:2}
.chart-breakdown .breakdown-title,.chart-breakdown .breakdown-value {fill:var(--urushi-color-accent-strong);font-weight:700}
.chart-annotation {border-left:5px solid var(--urushi-color-cool);padding:8px 26px;color:var(--urushi-color-text);font-size:37px}
`;
