import { describe, it, expect } from 'vitest';
import {
  mpWebhookEventSchema,
  createPreferenceBodySchema,
} from './webhook-schemas';

describe('mpWebhookEventSchema', () => {
  it('acepta evento con type y data.id', () => {
    const event = { type: 'payment', action: 'payment.updated', data: { id: '123' } };
    expect(mpWebhookEventSchema.safeParse(event).success).toBe(true);
  });

  it('acepta evento con data_id', () => {
    const event = { type: 'payment', data_id: 456 };
    expect(mpWebhookEventSchema.safeParse(event).success).toBe(true);
  });

  it('acepta payload vacío (passthrough)', () => {
    expect(mpWebhookEventSchema.safeParse({}).success).toBe(true);
  });
});

describe('createPreferenceBodySchema', () => {
  it('acepta userId y productId válidos', () => {
    const body = { userId: 'uid123', productId: 'analysis_1' };
    expect(createPreferenceBodySchema.safeParse(body).success).toBe(true);
  });

  it('acepta metadata opcional', () => {
    const body = {
      userId: 'uid',
      productId: 'pack_3',
      metadata: { coachId: 'c1', analysisId: 'a1' },
    };
    expect(createPreferenceBodySchema.safeParse(body).success).toBe(true);
  });

  it('rechaza userId vacío', () => {
    const body = { userId: '', productId: 'analysis_1' };
    expect(createPreferenceBodySchema.safeParse(body).success).toBe(false);
  });

  it('rechaza productId inválido', () => {
    const body = { userId: 'uid', productId: 'invalid' };
    expect(createPreferenceBodySchema.safeParse(body).success).toBe(false);
  });
});
