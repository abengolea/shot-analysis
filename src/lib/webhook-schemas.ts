import { z } from 'zod';

/** Esquema mínimo para evento de webhook Mercado Pago (payment.created / payment.updated) */
export const mpWebhookEventSchema = z.object({
  type: z.string().optional(),
  action: z.string().optional(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
  data_id: z.union([z.string(), z.number()]).optional(),
}).passthrough();

export type MPWebhookEvent = z.infer<typeof mpWebhookEventSchema>;

const productIds = ['analysis_1', 'pack_3', 'pack_10', 'history_plus_annual', 'coach_review'] as const;

/** Body para POST /api/payments/create-preference */
export const createPreferenceBodySchema = z.object({
  userId: z.string().min(1, 'userId requerido'),
  productId: z.enum(productIds),
  metadata: z
    .object({
      coachId: z.string().optional(),
      analysisId: z.string().optional(),
      unlockId: z.string().optional(),
      playerId: z.string().optional(),
    })
    .optional(),
});

export type CreatePreferenceBody = z.infer<typeof createPreferenceBodySchema>;
