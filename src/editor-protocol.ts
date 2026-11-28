export interface SlideInfo { name: string; interval: boolean }
export interface Preview {
  id: string;
  snapshot?: number;
  title: string;
  slides: SlideInfo[];
}
export type JobEvent =
  | { type: 'phase'; phase: 'yaml' | 'build' | 'check' | 'fix'; iteration: number }
  | { type: 'text'; chars: number }
  | { type: 'preview'; preview: Preview }
  | { type: 'done'; preview: Preview; provider: string; model: string }
  | { type: 'failed'; error: string };
