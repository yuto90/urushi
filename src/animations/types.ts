import { z } from 'zod';

export const animationParameterSchema = z.object({
  type: z.enum(['number', 'string', 'boolean']),
  default: z.union([z.number(), z.string(), z.boolean()]).optional(),
  description: z.string().optional(),
});

export const animationSpecSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  description: z.string().min(1),
  parameters: z.record(z.string(), animationParameterSchema).default({}),
  duration: z.number().positive().max(5),
  trigger: z.enum(['slide-enter', 'after-previous', 'manual']),
  staticState: z.literal('final'),
  target: z.enum(['self', 'children']).default('self'),
  effect: z.enum(['assemble', 'bar', 'count', 'steps', 'morph', 'balance', 'flow', 'generic']).default('generic'),
  intro: z.record(z.string(), z.number()).optional(),
  final: z.record(z.string(), z.number()).optional(),
});

export type AnimationSpec = z.infer<typeof animationSpecSchema>;
