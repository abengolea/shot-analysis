import Link from "next/link";
import Image from "next/image";
import { Star, Award, Briefcase, DollarSign, MessageSquare } from "lucide-react";
import { mockCoaches } from "@/lib/mock-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CoachesPage() {
  const coaches = mockCoaches;

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Encuentra tu Entrenador
        </h1>
        <p className="mt-2 text-muted-foreground">
          Conecta con entrenadores profesionales para obtener feedback personalizado.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {coaches.map((coach) => (
          <Card key={coach.id} className="flex flex-col">
            <CardHeader className="items-center text-center">
              <Avatar className="h-24 w-24 border-4 border-primary/20">
                <AvatarImage src={coach.avatarUrl} alt={coach.name} data-ai-hint={coach['data-ai-hint']} />
                <AvatarFallback>{coach.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <CardTitle className="font-headline pt-2 text-2xl">{coach.name}</CardTitle>
               <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
                <span>{coach.rating.toFixed(1)}</span>
                <span>({coach.reviews} reseñas)</span>
              </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
               <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Especialidades</h4>
                  <div className="flex flex-wrap gap-2">
                    {coach.specialties.map(spec => <Badge key={spec} variant="secondary">{spec}</Badge>)}
                  </div>
              </div>
               <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Experiencia</h4>
                  <p className="text-sm text-muted-foreground">{coach.experience}</p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-2 pt-4">
                 <div className="flex justify-center items-baseline">
                    <span className="font-headline text-3xl font-bold">${coach.rate}</span>
                    <span className="text-sm text-muted-foreground">/hora</span>
                 </div>
              <Button>
                 <MessageSquare className="mr-2 h-4 w-4" /> Enviar Mensaje
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
