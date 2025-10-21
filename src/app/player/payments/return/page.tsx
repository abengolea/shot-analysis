import Link from 'next/link';

type SearchParams = { [key: string]: string | string[] | undefined };

function getParam(params: SearchParams, key: string): string | undefined {
  const v = params[key];
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

export default function PaymentsReturnPage({ searchParams }: { searchParams: SearchParams }) {
  const status = (getParam(searchParams, 'status') || '').toLowerCase();
  const collectionStatus = (getParam(searchParams, 'collection_status') || '').toLowerCase();
  const preferenceId = getParam(searchParams, 'preference_id') || getParam(searchParams, 'preferenceId');
  const paymentId = getParam(searchParams, 'payment_id');
  const merchantOrderId = getParam(searchParams, 'merchant_order_id');

  const approved = status === 'approved' || collectionStatus === 'approved';
  const pending = status === 'pending' || collectionStatus === 'pending';
  const failure = status === 'failure' || collectionStatus === 'rejected' || (!approved && !pending);

  const title = approved
    ? 'Pago aprobado'
    : pending
      ? 'Pago pendiente'
      : 'Pago no aprobado';

  const desc = approved
    ? 'Gracias. Acreditaremos tus créditos en breve. Puedes volver a la app.'
    : pending
      ? 'Mercado Pago está procesando tu pago. Se acreditará automáticamente cuando se apruebe.'
      : 'Tu pago no se aprobó o fue cancelado. Puedes intentar nuevamente.';

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground mb-6">{desc}</p>

      <div className="rounded-md border p-4 text-sm space-y-1">
        {paymentId ? (<div><span className="font-medium">payment_id:</span> {paymentId}</div>) : null}
        {preferenceId ? (<div><span className="font-medium">preference_id:</span> {preferenceId}</div>) : null}
        {merchantOrderId ? (<div><span className="font-medium">merchant_order_id:</span> {merchantOrderId}</div>) : null}
        {status ? (<div><span className="font-medium">status:</span> {status}</div>) : null}
        {collectionStatus ? (<div><span className="font-medium">collection_status:</span> {collectionStatus}</div>) : null}
      </div>

      <div className="mt-8 flex gap-3">
        <Link className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-white text-sm" href="/dashboard">Volver al panel</Link>
        <Link className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm" href="/upload">Cargar análisis</Link>
      </div>
    </div>
  );
}

