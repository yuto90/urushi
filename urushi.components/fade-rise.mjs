export default {
  name: 'fade-rise',
  description: 'ユーザー部品の例: 要素がふわっと浮き上がる',
  parameters: { distance: { type: 'number', default: 28 } },
  duration: 0.6,
  trigger: 'slide-enter',
  staticState: 'final',
  target: 'children',
  effect: 'generic',
  intro: { opacity: 0, y: 28 },
  final: { opacity: 1, y: 0 }
};
