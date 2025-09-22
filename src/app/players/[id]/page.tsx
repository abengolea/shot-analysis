import { redirect } from 'next/navigation';

export default function PlayersRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  // Por defecto, redirigir a la vista de jugador
  // En el futuro, podríamos detectar el rol del usuario y redirigir apropiadamente
  redirect(`/player/players/${params.id}`);
}
