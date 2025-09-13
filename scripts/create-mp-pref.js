// Node script to create a Mercado Pago preference for test payments
// Reads credentials from .env.local and outputs init_point

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnv();
  const accessToken = process.env.MP_ACCESS_TOKEN_AR;
  const webhookUrl = process.env.MP_WEBHOOK_URL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const userEmail = process.argv[2] || 'test@example.com';
  const amount = Number(process.argv[3] || 100);

  if (!accessToken) {
    console.error('MP_ACCESS_TOKEN_AR no configurado');
    process.exit(1);
  }
  if (!webhookUrl) {
    console.error('MP_WEBHOOK_URL no configurado');
    process.exit(1);
  }

  const body = {
    items: [
      { title: 'Pago de prueba (1 crédito)', quantity: 1, unit_price: amount, currency_id: 'ARS' },
    ],
    metadata: {
      userEmail: userEmail.toLowerCase(),
      productId: 'analysis_1',
    },
    notification_url: webhookUrl,
    back_urls: { success: appUrl, failure: appUrl, pending: appUrl },
    auto_return: 'approved',
  };

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error('Error creando preferencia:', res.status, txt);
    process.exit(2);
  }
  const pref = await res.json();
  console.log(JSON.stringify({ id: pref.id, init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(3); });


