import { redirect } from 'next/navigation';

export default function PaymentsRedirect() {
  redirect('/player/payments');
}
