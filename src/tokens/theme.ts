export const themeName = 'urushi-dark';

export const tokenCss = `
:root {
  --urushi-color-bg: #101319;
  --urushi-color-bg-soft: #171c25;
  --urushi-color-panel: #202735;
  --urushi-color-panel-strong: #293347;
  --urushi-color-text: #f5f1e8;
  --urushi-color-muted: #b9c0cf;
  --urushi-color-faint: #7f899c;
  --urushi-color-accent: #d6a84f;
  --urushi-color-accent-strong: #f0c568;
  --urushi-color-accent-soft: rgba(214, 168, 79, 0.16);
  --urushi-color-cool: #69a8c8;
  --urushi-color-cool-soft: rgba(105, 168, 200, 0.14);
  --urushi-color-positive: #78bf91;
  --urushi-color-negative: #d97777;
  --urushi-color-line: rgba(245, 241, 232, 0.16);
  --urushi-font-sans: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif;
  --urushi-font-serif: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif;
  --urushi-space-1: 8px;
  --urushi-space-2: 16px;
  --urushi-space-3: 24px;
  --urushi-space-4: 40px;
  --urushi-space-5: 64px;
  --urushi-radius-sm: 10px;
  --urushi-radius-md: 20px;
  --urushi-radius-lg: 34px;
  --urushi-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
}
`;

export const slideCss = `
* { box-sizing: border-box; }
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: var(--urushi-color-bg); color: var(--urushi-color-text); font-family: var(--urushi-font-sans); }
body { -webkit-font-smoothing: antialiased; }
.urushi-stage { position: fixed; inset: 0; overflow: hidden; background: radial-gradient(circle at 75% 10%, var(--urushi-color-accent-soft), transparent 32%), var(--urushi-color-bg); }
.urushi-deck { position: absolute; left: 50%; top: 50%; width: 1920px; height: 1080px; transform-origin: center center; }
.slide { position: absolute; inset: 0; width: 1920px; height: 1080px; display: none; overflow: hidden; padding: var(--urushi-space-5) calc(var(--urushi-space-5) + var(--urushi-space-2)); background: linear-gradient(145deg, var(--urushi-color-bg), var(--urushi-color-bg-soft)); }
.slide.active { display: block; }
.slide::before { content: ""; position: absolute; inset: auto -220px -320px auto; width: 700px; height: 700px; border-radius: 50%; background: var(--urushi-color-accent-soft); filter: blur(2px); }
.slide-inner { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; }
.slide-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--urushi-space-4); margin-bottom: var(--urushi-space-4); }
.eyebrow { color: var(--urushi-color-accent-strong); font-size: 22px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: var(--urushi-space-2); }
h1.slide-title { font-family: var(--urushi-font-serif); font-size: 54px; line-height: 1.15; letter-spacing: 0.02em; margin: 0; max-width: 1380px; }
.slide-kicker { color: var(--urushi-color-muted); font-size: 24px; line-height: 1.5; max-width: 1200px; margin: var(--urushi-space-2) 0 0; }
.slide-body { flex: 1; min-height: 0; position: relative; }
.slide-number { color: var(--urushi-color-faint); font-size: 18px; letter-spacing: 0.08em; padding-top: var(--urushi-space-2); }
.u-muted { color: var(--urushi-color-muted); }
.u-card { background: linear-gradient(180deg, var(--urushi-color-panel), var(--urushi-color-bg-soft)); border: 1px solid var(--urushi-color-line); border-radius: var(--urushi-radius-md); box-shadow: var(--urushi-shadow); }
.u-emphasis { color: var(--urushi-color-accent-strong); }
.conclusion-layout { height: 100%; display: flex; flex-direction: column; justify-content: center; gap: var(--urushi-space-4); }
.conclusion-statement { font-family: var(--urushi-font-serif); font-size: 68px; line-height: 1.35; max-width: 1440px; margin: 0; }
.conclusion-evidence { display: flex; flex-wrap: wrap; gap: var(--urushi-space-2); max-width: 1500px; }
.evidence-chip { padding: var(--urushi-space-2) var(--urushi-space-3); border-radius: var(--urushi-radius-lg); background: var(--urushi-color-panel); border: 1px solid var(--urushi-color-line); color: var(--urushi-color-muted); font-size: 25px; line-height: 1.4; }
.call-to-action { display: inline-flex; align-self: flex-start; margin-top: var(--urushi-space-2); padding: var(--urushi-space-2) var(--urushi-space-4); border-radius: var(--urushi-radius-lg); background: var(--urushi-color-accent); color: var(--urushi-color-bg); font-size: 28px; font-weight: 800; }
.comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--urushi-space-4); height: calc(100% - 124px); }
.comparison-panel { position: relative; padding: var(--urushi-space-4); overflow: hidden; }
.comparison-panel.left { border-top: 6px solid var(--urushi-color-cool); }
.comparison-panel.right { border-top: 6px solid var(--urushi-color-accent); }
.comparison-label { font-size: 32px; font-weight: 800; margin: 0 0 var(--urushi-space-2); }
.comparison-summary { font-size: 25px; color: var(--urushi-color-muted); line-height: 1.5; margin: 0 0 var(--urushi-space-3); }
.comparison-points { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--urushi-space-2); }
.comparison-points li { position: relative; padding-left: var(--urushi-space-3); color: var(--urushi-color-text); font-size: 26px; line-height: 1.45; }
.comparison-points li::before { content: ""; position: absolute; left: 0; top: 0.68em; width: 10px; height: 10px; border-radius: 50%; background: var(--urushi-color-accent); }
.score-block { margin: var(--urushi-space-3) 0; }
.score-number { font-size: 48px; font-weight: 900; color: var(--urushi-color-accent-strong); line-height: 1; }
.score-label { color: var(--urushi-color-faint); font-size: 18px; margin-left: var(--urushi-space-1); }
.bar-track { margin-top: var(--urushi-space-2); height: 16px; border-radius: var(--urushi-radius-lg); background: var(--urushi-color-bg); overflow: hidden; }
.u-bar { display: block; height: 100%; width: var(--bar-value, 0%); border-radius: var(--urushi-radius-lg); background: linear-gradient(90deg, var(--urushi-color-cool), var(--urushi-color-accent)); }
.verdict-strip { height: 92px; margin-top: var(--urushi-space-3); display: flex; align-items: center; padding: 0 var(--urushi-space-4); border-radius: var(--urushi-radius-md); background: var(--urushi-color-accent-soft); border: 1px solid var(--urushi-color-accent); font-size: 30px; font-weight: 750; }
.causal-flow { height: 100%; display: grid; grid-template-columns: 1fr 0.9fr 1fr; gap: var(--urushi-space-3); align-items: center; }
.causal-box { padding: var(--urushi-space-4); min-height: 330px; display: flex; flex-direction: column; justify-content: center; }
.causal-label { color: var(--urushi-color-accent-strong); font-size: 21px; font-weight: 800; letter-spacing: 0.12em; margin-bottom: var(--urushi-space-2); }
.causal-text { font-size: 36px; line-height: 1.45; font-weight: 750; margin: 0; }
.causal-mechanism { display: flex; flex-direction: column; gap: var(--urushi-space-2); }
.mechanism-item { position: relative; padding: var(--urushi-space-2) var(--urushi-space-3); border-radius: var(--urushi-radius-md); background: var(--urushi-color-cool-soft); border: 1px solid var(--urushi-color-line); font-size: 24px; line-height: 1.4; }
.causal-arrow { color: var(--urushi-color-accent); text-align: center; font-size: 40px; }
.implication-strip { position: absolute; left: 0; right: 0; bottom: 0; padding: var(--urushi-space-3) var(--urushi-space-4); border-radius: var(--urushi-radius-md); background: var(--urushi-color-panel); border: 1px solid var(--urushi-color-line); font-size: 28px; color: var(--urushi-color-muted); }
.process-steps { height: 72%; display: grid; grid-template-columns: repeat(var(--step-count, 4), 1fr); gap: var(--urushi-space-3); align-items: stretch; }
.process-step { padding: var(--urushi-space-3); overflow: hidden; }
.step-index { width: 54px; height: 54px; margin-bottom: var(--urushi-space-2); border-radius: 50%; display: grid; place-items: center; background: var(--urushi-color-accent); color: var(--urushi-color-bg); font-size: 24px; font-weight: 900; }
.step-title { font-size: 30px; line-height: 1.3; margin: 0 0 var(--urushi-space-2); font-weight: 800; }
.step-description { color: var(--urushi-color-muted); font-size: 23px; line-height: 1.5; margin: 0; }
.outcome-strip { margin-top: var(--urushi-space-4); padding: var(--urushi-space-3) var(--urushi-space-4); border-radius: var(--urushi-radius-md); background: var(--urushi-color-accent-soft); border-left: 6px solid var(--urushi-color-accent); font-size: 30px; font-weight: 750; }
.list-grid { height: calc(100% - 116px); display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--urushi-space-3); }
.list-grid.count-5, .list-grid.count-6 { grid-template-columns: repeat(3, 1fr); }
.list-item { padding: var(--urushi-space-3); overflow: hidden; }
.list-item-title { font-size: 30px; margin: 0 0 var(--urushi-space-2); color: var(--urushi-color-accent-strong); font-weight: 800; }
.list-item-description { color: var(--urushi-color-muted); font-size: 24px; line-height: 1.5; margin: 0; }
.takeaway-strip { height: 84px; margin-top: var(--urushi-space-3); display: flex; align-items: center; padding: 0 var(--urushi-space-3); border-radius: var(--urushi-radius-md); background: var(--urushi-color-panel-strong); font-size: 27px; font-weight: 750; }
.custom-frame { height: 100%; overflow: hidden; border-radius: var(--urushi-radius-md); }
.custom-frame > * { max-width: 100%; }
.deck-footer { position: fixed; right: 22px; bottom: 18px; z-index: 20; color: var(--urushi-color-muted); font: 15px var(--urushi-font-sans); opacity: 0.86; }
@media print {
  html, body { width: 1920px; height: auto; overflow: visible; background: var(--urushi-color-bg); }
  .urushi-stage { position: static; width: 1920px; height: auto; overflow: visible; }
  .urushi-deck { position: static; transform: none !important; width: 1920px; height: auto; }
  .slide, .slide.active { position: relative; display: block !important; width: 1920px; height: 1080px; page-break-after: always; break-after: page; overflow: hidden; }
  .deck-footer { display: none; }
}
`;
