import type { AnimationSpec } from './types.js';

export const builtInAnimations: AnimationSpec[] = [
  {
    name: 'assemble',
    description: '図の構成要素が下から順に組み上がる',
    parameters: { stagger: { type: 'number', default: 0.12 }, distance: { type: 'number', default: 44 } },
    duration: 0.8,
    trigger: 'slide-enter',
    staticState: 'final',
    target: 'children',
    effect: 'assemble',
  },
  {
    name: 'bar-grow',
    description: 'バーが0から伸び、数値と一緒に強調される',
    parameters: { stagger: { type: 'number', default: 0.16 } },
    duration: 0.9,
    trigger: 'slide-enter',
    staticState: 'final',
    target: 'self',
    effect: 'bar',
  },
  {
    name: 'count-up',
    description: '数値が0から最終値までカウントアップする',
    parameters: { decimals: { type: 'number', default: 0 } },
    duration: 1.1,
    trigger: 'slide-enter',
    staticState: 'final',
    target: 'self',
    effect: 'count',
  },
  {
    name: 'step-in',
    description: '手順や項目が左から順に出現する',
    parameters: { stagger: { type: 'number', default: 0.14 } },
    duration: 0.7,
    trigger: 'slide-enter',
    staticState: 'final',
    target: 'children',
    effect: 'steps',
  },
  {
    name: 'morph-compare',
    description: '比較対象が左右から入れ替わるように現れ、差分を強調する',
    parameters: { distance: { type: 'number', default: 90 } },
    duration: 0.85,
    trigger: 'slide-enter',
    staticState: 'final',
    target: 'self',
    effect: 'morph',
  },
  {
    name: 'balance',
    description: '左右の対比要素が天秤のように両側から入る',
    parameters: { distance: { type: 'number', default: 120 } },
    duration: 0.9,
    trigger: 'slide-enter',
    staticState: 'final',
    target: 'self',
    effect: 'balance',
  },
  {
    name: 'data-flow',
    description: 'データや因果の流れがノードと矢印に沿って流れ込む',
    parameters: { stagger: { type: 'number', default: 0.13 } },
    duration: 0.75,
    trigger: 'slide-enter',
    staticState: 'final',
    target: 'self',
    effect: 'flow',
  },
];

export function animationCatalogText(specs: AnimationSpec[]): string {
  return specs
    .map((spec) => {
      const params = Object.entries(spec.parameters)
        .map(([name, parameter]) => `${name}(${parameter.type}, default=${String(parameter.default ?? 'なし')})`)
        .join(', ');
      return `- ${spec.name}: ${spec.description} / duration=${spec.duration}s / trigger=${spec.trigger} / PDF=${spec.staticState}${params ? ` / params: ${params}` : ''}`;
    })
    .join('\n');
}
