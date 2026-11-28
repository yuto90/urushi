import { z } from 'zod';

const label = z.string().min(1).max(16);
const amount = z.object({ label, value: z.number().min(0).max(1_000_000_000) });

const barChart = z.object({
  kind: z.literal('bar').optional(),
  id: z.string().min(1).max(40),
  unit: z.string().max(8),
  bars: z.array(amount).min(2).max(12),
  breakdown: z.object({
    bar: label,
    items: z.array(amount).min(1).max(4),
  }).optional(),
});

const flowChart = z.object({
  kind: z.literal('flow'),
  id: z.string().min(1).max(40),
  nodes: z.array(z.object({ label, description: z.string().max(38).optional() })).min(2).max(5),
});

export const chartSchema = z.union([flowChart, barChart]);
export function chartLabels(chart: Chart) {
  return (chart.kind === 'flow' ? chart.nodes : chart.bars).map((item) => item.label);
}

export const transitionSchema = z.object({
  emphasisDuration: z.number().min(0.1).max(4),
  headlineDelay: z.number().min(0).max(6),
  detailDuration: z.number().min(0.1).max(4),
}).strict();

export const chartState = {
  type: z.literal('chart'),
  title: z.string().min(1).max(30),
  chartId: z.string().min(1).max(40),
  headline: z.string().min(1).max(42),
  highlight: z.array(label).max(12).optional(),
  showBreakdown: z.boolean().optional(),
  annotation: z.string().min(1).max(50).optional(),
  transition: transitionSchema.optional(),
};

export type Chart = z.infer<typeof chartSchema>;
export type Transition = z.infer<typeof transitionSchema>;
