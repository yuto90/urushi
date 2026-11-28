import type { gsap } from 'gsap';
import type { Slide } from '../schema/index.js';

type State = Extract<Slide, { type: 'chart' }>;

// Serialized into the standalone deck. All dependencies at runtime are DOM nodes and the bundled GSAP.
export function createChartPlayer(slides: HTMLElement[], animator: typeof gsap | undefined, print: boolean) {
  const graphs = new Map<string, HTMLElement>();
  const states = slides.map((slide) => {
    const host = slide.querySelector<HTMLElement>('.chart-host');
    if (!host) return;
    const state: State = JSON.parse(host.dataset.chartState!);
    const graph = host.firstElementChild as HTMLElement;
    if (!graphs.has(state.chartId)) graphs.set(state.chartId, graph);
    else if (!print) graph.remove();
    return { host, state };
  });
  let timeline: gsap.core.Timeline | undefined;

  function show(from: number, to: number, animate: boolean) {
    timeline?.kill();
    timeline = undefined;
    const target = states[to];
    if (!target || print) return;
    const graph = graphs.get(target.state.chartId)!;
    if (graph.parentElement !== target.host) target.host.append(graph);
    const items = Array.from(graph.querySelectorAll<HTMLElement | SVGGElement>('.chart-bar, .flow-node'));
    const headline = graph.querySelector<HTMLElement>('.chart-headline')!;
    const detail = graph.querySelector<SVGGElement>('.chart-detail');
    const card = graph.querySelector<SVGGElement>('.chart-breakdown');
    const leader = graph.querySelector<SVGPathElement>('.chart-leader');
    const note = graph.querySelector<HTMLElement>('.chart-annotation')!;
    const opacity = (state: State, item: HTMLElement | SVGGElement) =>
      !state.highlight?.length || state.highlight.includes(item.dataset.label!) ? 1 : 0.28;
    function settle(state: State) {
      items.forEach((item) => { item.style.opacity = String(opacity(state, item)); });
      headline.textContent = state.headline;
      headline.style.opacity = '1';
      note.textContent = state.annotation ?? '';
      note.style.opacity = state.annotation ? '1' : '0';
      if (detail) detail.style.opacity = state.showBreakdown ? '1' : '0';
      if (card && animator) animator.set(card, { x: 0 });
      if (leader) leader.style.strokeDashoffset = '0';
    }
    const end = target.state;
    const start = states[from]?.state;
    if (!animator || !animate || to !== from + 1 || start?.chartId !== end.chartId) {
      settle(end);
      return;
    }
    settle(start);
    const timing = end.transition ?? { emphasisDuration: 0.55, headlineDelay: 0.65, detailDuration: 0.65 };
    timeline = animator.timeline({ onComplete: () => settle(end) });
    for (const item of items) timeline.to(item, { opacity: opacity(end, item), duration: timing.emphasisDuration }, 0);
    if (start.headline !== end.headline) {
      timeline.to(headline, { opacity: 0, duration: 0.18 }, timing.headlineDelay)
        .call(() => { headline.textContent = end.headline; })
        .to(headline, { opacity: 1, duration: 0.28 });
    }
    const revealAt = timing.emphasisDuration;
    if (detail && card && leader && start.showBreakdown !== end.showBreakdown) {
      timeline.to(detail, { opacity: end.showBreakdown ? 1 : 0, duration: timing.detailDuration }, revealAt);
      if (end.showBreakdown) {
        timeline.fromTo(leader, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: timing.detailDuration }, revealAt);
        timeline.fromTo(card, { x: -Number(card.dataset.travel) }, { x: 0, duration: timing.detailDuration, ease: 'power2.out' }, revealAt);
      }
    }
    if (start.annotation !== end.annotation) {
      timeline.to(note, { opacity: 0, duration: 0.12 }, revealAt)
        .call(() => { note.textContent = end.annotation ?? ''; }, [], revealAt + timing.detailDuration)
        .to(note, { opacity: end.annotation ? 1 : 0, duration: 0.3 }, revealAt + timing.detailDuration);
    }
  }
  return show;
}
