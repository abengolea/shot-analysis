import { redirect } from 'next/navigation';

export default function PlayersRedirect() {
  redirect('/player/players');
}
