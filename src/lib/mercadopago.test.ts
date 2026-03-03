import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyWebhookSignature } from './mercadopago';

function buildValidSignature(params: { dataId: string; xRequestId: string; ts: string; secret: string }): string {
  const { dataId, xRequestId, ts, secret } = params;
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${ts},v1=${hash}`;
}

describe('verifyWebhookSignature', () => {
  const secret = 'test-secret-key';

  it('retorna true si secret está vacío (modo dev)', () => {
    expect(
      verifyWebhookSignature({
        xSignature: 'ts=123,v1=abc',
        xRequestId: 'req-1',
        dataId: 'pay-1',
        secret: '',
      })
    ).toBe(true);
  });

  it('retorna false si x-signature falta o no tiene v1', () => {
    expect(
      verifyWebhookSignature({
        xSignature: null,
        xRequestId: 'req-1',
        dataId: 'pay-1',
        secret,
      })
    ).toBe(false);
    expect(
      verifyWebhookSignature({
        xSignature: 'ts=123',
        xRequestId: 'req-1',
        dataId: 'pay-1',
        secret,
      })
    ).toBe(false);
  });

  it('retorna true cuando la firma es válida', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const xRequestId = 'req-123';
    const dataId = 'pay-456';
    const xSignature = buildValidSignature({ dataId, xRequestId, ts, secret });
    expect(
      verifyWebhookSignature({
        xSignature,
        xRequestId,
        dataId,
        secret,
      })
    ).toBe(true);
  });

  it('retorna false cuando la firma está adulterada', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const xSignature = buildValidSignature({
      dataId: 'pay-456',
      xRequestId: 'req-123',
      ts,
      secret,
    });
    expect(
      verifyWebhookSignature({
        xSignature,
        xRequestId: 'req-123',
        dataId: 'pay-999',
        secret,
      })
    ).toBe(false);
  });
});
