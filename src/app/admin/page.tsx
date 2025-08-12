import { CoachAdminForm } from "@/components/coach-admin-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mockCoaches } from "@/lib/mock-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function AdminPage() {
  const coaches = mockCoaches;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Panel de Administración
        </h1>
        <p className="mt-2 text-muted-foreground">
          Gestiona los entrenadores de la plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <CoachAdminForm />

        <Card>
          <CardHeader>
            <CardTitle>Entrenadores Actuales</CardTitle>
            <CardDescription>Lista de todos los entrenadores en el sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {coaches.map((coach) => (
              <div key={coach.id} className="flex items-center gap-4 rounded-md border p-3">
                 <Avatar>
                    <AvatarImage src={coach.avatarUrl} alt={coach.name} />
                    <AvatarFallback>{coach.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <p className="font-semibold">{coach.name}</p>
                    <p className="text-sm text-muted-foreground">${coach.rate}/hr</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                    {coach.specialties.map(spec => <Badge key={spec} variant="secondary" className="text-xs">{spec}</Badge>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
