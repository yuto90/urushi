import { z } from 'zod';
import { parse as parseYaml } from 'yaml';

const baseSlide = {
  id: z.string().min(1).max(40).optional(),
  animation: z.string().min(1).max(80).optional(),
  notes: z.string().max(800).optional(),
};

const shortText = z.string().min(1).max(42);
const bulletText = z.string().min(1).max(64);

export const conclusionSlideSchema = z.object({
  type: z.literal('conclusion'),
  title: shortText,
  conclusion: z.string().min(1).max(110),
  evidence: z.array(bulletText).max(4).optional(),
  callToAction: z.string().min(1).max(52).optional(),
  ...baseSlide,
});

export const comparisonSideSchema = z.object({
  label: z.string().min(1).max(24),
  summary: z.string().min(1).max(72).optional(),
  points: z.array(bulletText).min(1).max(5),
  score: z.number().min(0).max(100).optional(),
});

export const comparisonSlideSchema = z.object({
  type: z.literal('comparison'),
  title: shortText,
  left: comparisonSideSchema,
  right: comparisonSideSchema,
  verdict: z.string().min(1).max(90).optional(),
  ...baseSlide,
});

export const causalSlideSchema = z.object({
  type: z.literal('causal'),
  title: shortText,
  cause: z.string().min(1).max(72),
  mechanism: z.array(z.string().min(1).max(46)).min(1).max(4),
  effect: z.string().min(1).max(72),
  implication: z.string().min(1).max(90).optional(),
  ...baseSlide,
});

export const processStepSchema = z.object({
  title: z.string().min(1).max(30),
  description: z.string().min(1).max(72).optional(),
});

export const processSlideSchema = z.object({
  type: z.literal('process'),
  title: shortText,
  steps: z.array(processStepSchema).min(2).max(6),
  outcome: z.string().min(1).max(90).optional(),
  ...baseSlide,
});

export const listItemSchema = z.object({
  title: z.string().min(1).max(34),
  description: z.string().min(1).max(82).optional(),
});

export const listSlideSchema = z.object({
  type: z.literal('list'),
  title: shortText,
  items: z.array(listItemSchema).min(2).max(6),
  takeaway: z.string().min(1).max(90).optional(),
  ...baseSlide,
});

export const customSlideSchema = z.object({
  type: z.literal('custom'),
  title: shortText.optional(),
  html: z.string().min(1).max(20000),
  ...baseSlide,
});

export const slideSchema = z.discriminatedUnion('type', [
  conclusionSlideSchema,
  comparisonSlideSchema,
  causalSlideSchema,
  processSlideSchema,
  listSlideSchema,
  customSlideSchema,
]);

export const deckSchema = z.object({
  version: z.literal(1).optional(),
  meta: z.object({
    title: z.string().min(1).max(70),
    subtitle: z.string().max(100).optional(),
    author: z.string().max(60).optional(),
    theme: z.literal('urushi-dark').optional(),
  }),
  slides: z.array(slideSchema).min(1).max(20),
});

export type Deck = z.infer<typeof deckSchema>;
export type Slide = z.infer<typeof slideSchema>;
export type ConclusionSlide = z.infer<typeof conclusionSlideSchema>;
export type ComparisonSlide = z.infer<typeof comparisonSlideSchema>;
export type CausalSlide = z.infer<typeof causalSlideSchema>;
export type ProcessSlide = z.infer<typeof processSlideSchema>;
export type ListSlide = z.infer<typeof listSlideSchema>;
export type CustomSlide = z.infer<typeof customSlideSchema>;

export const deckJsonSchema = z.toJSONSchema(deckSchema, {
  target: 'draft-2020-12',
});

export type DeckValidationResult =
  | { ok: true; deck: Deck }
  | { ok: false; errors: z.core.$ZodIssue[] };

export function validateDeck(input: unknown): DeckValidationResult {
  const result = deckSchema.safeParse(input);
  if (result.success) return { ok: true, deck: result.data };
  return { ok: false, errors: result.error.issues };
}

export function parseDeckYaml(yamlText: string): DeckValidationResult {
  return validateDeck(parseYaml(yamlText));
}

export function zodIssuePath(issue: z.core.$ZodIssue): string {
  return issue.path.map((part) => String(part)).join('.');
}
