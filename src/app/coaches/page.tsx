"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Star, 
  Award, 
  Briefcase, 
  DollarSign, 
  MessageSquare, 
  Search, 
  Filter,
  MapPin,
  Clock,
  Users,
  Trophy,
  GraduationCap
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import type { Coach } from "@/lib/types";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export default function CoachesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [maxPrice, setMaxPrice] = useState<number>(100);
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>("rating");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const colRef = collection(db as any, 'coaches');
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Coach[];
        setCoaches(list);
        setLoading(false);
      }, (err) => {
        console.error('Error cargando entrenadores:', err);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error('Error inicializando carga de entrenadores:', e);
      setLoading(false);
    }
  }, []);

  // Get unique specialties for filter
  const specialties = useMemo(() => {
    const allSpecialties = coaches.flatMap(coach => coach.specialties || []);
    return [...new Set(allSpecialties)];
  }, [coaches]);

  // Filter and sort coaches
  const filteredCoaches = useMemo(() => {
    let filtered = coaches.filter(coach => {
      const matchesSearch = coach.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          coach.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          coach.specialties?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesSpecialty = selectedSpecialty === 'all' || coach.specialties?.includes(selectedSpecialty);
      const matchesPrice = coach.ratePerAnalysis && coach.ratePerAnalysis <= maxPrice;
      const matchesRating = coach.rating && coach.rating >= minRating;

      return matchesSearch && matchesSpecialty && matchesPrice && matchesRating;
    });

    // Sort coaches
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "reviews":
          return (b.reviews || 0) - (a.reviews || 0);
        case "price":
          return (a.ratePerAnalysis || 0) - (b.ratePerAnalysis || 0);
        case "experience":
          return (b.yearsOfExperience || 0) - (a.yearsOfExperience || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [coaches, searchTerm, selectedSpecialty, maxPrice, minRating, sortBy]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? "fill-yellow-400 text-yellow-500"
            : i < rating
            ? "fill-yellow-400/50 text-yellow-500"
            : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Encuentra tu Entrenador
        </h1>
        <p className="mt-2 text-muted-foreground">
          Conecta con entrenadores profesionales para obtener feedback personalizado.
        </p>
        <div className="mt-4">
          <Link href="/coach-register" className="text-primary underline">
            ¿Eres entrenador? Crea tu perfil aquí
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar entrenadores por nombre, especialidad o experiencia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>

          {/* Specialty Filter */}
          <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Especialidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las especialidades</SelectItem>
              {specialties.map((specialty) => (
                <SelectItem key={specialty} value={specialty}>
                  {specialty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Price Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Precio máximo: ${maxPrice}</span>
            <Slider
              value={[maxPrice]}
              onValueChange={(value) => setMaxPrice(value[0])}
              max={100}
              min={20}
              step={5}
              className="w-32"
            />
          </div>

          {/* Rating Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rating mínimo: {minRating}</span>
            <Slider
              value={[minRating]}
              onValueChange={(value) => setMinRating(value[0])}
              max={5}
              min={0}
              step={0.5}
              className="w-32"
            />
          </div>

          {/* Sort By */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Mejor Rating</SelectItem>
              <SelectItem value="reviews">Más Reseñas</SelectItem>
              <SelectItem value="price">Precio más bajo</SelectItem>
              <SelectItem value="experience">Más Experiencia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          Mostrando {filteredCoaches.length} de {coaches.length} entrenadores
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">Cargando entrenadores...</div>
      )}

      {/* Coaches Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCoaches.map((coach) => (
          <Card key={coach.id} className="flex flex-col hover:shadow-lg transition-shadow">
            <CardHeader className="items-center text-center pb-4">
              <Avatar className="h-24 w-24 border-4 border-primary/20">
                <AvatarImage src={coach.avatarUrl} alt={coach.name} />
                <AvatarFallback>{coach.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <CardTitle className="font-headline pt-2 text-2xl">{coach.name}</CardTitle>
              
              {/* Rating and Reviews */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  {renderStars(coach.rating || 0)}
                </div>
                <span className="text-sm font-semibold text-primary">
                  {coach.rating?.toFixed(1)}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                ({coach.reviews} reseñas)
              </div>

              {/* Specialties */}
              <div className="flex flex-wrap gap-1 justify-center">
                {coach.specialties?.slice(0, 3).map((specialty) => (
                  <Badge key={specialty} variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
              </div>
            </CardHeader>

            <CardContent className="flex-grow space-y-4">
              {/* Experience */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" /> 
                  Experiencia
                </h4>
                <p className="text-sm text-muted-foreground">{coach.experience}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {coach.yearsOfExperience} años
                </div>
              </div>

              {/* Bio */}
              {coach.bio && (
                <div>
                  <h4 className="font-semibold mb-2">Biografía</h4>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {coach.bio}
                  </p>
                </div>
              )}

              {/* Certifications */}
              {coach.certifications && coach.certifications.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Certificaciones
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {coach.certifications.slice(0, 2).map((cert) => (
                      <Badge key={cert} variant="outline" className="text-xs">
                        {cert}
                      </Badge>
                    ))}
                    {coach.certifications.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{coach.certifications.length - 2} más
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Education */}
              {coach.education && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Educación
                  </h4>
                  <p className="text-sm text-muted-foreground">{coach.education}</p>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col items-stretch gap-3 pt-4">
              {/* Price */}
              <div className="flex justify-center items-baseline">
                <span className="font-headline text-3xl font-bold text-primary">
                  ${coach.ratePerAnalysis}
                </span>
                <span className="text-sm text-muted-foreground">/análisis</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <MessageSquare className="mr-2 h-4 w-4" /> 
                  Mensaje
                </Button>
                <Button className="flex-1">
                  <Users className="mr-2 h-4 w-4" /> 
                  Conectar
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* No Results */}
      {filteredCoaches.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron entrenadores</h3>
            <p>Intenta ajustar los filtros o términos de búsqueda</p>
          </div>
        </div>
      )}
    </div>
  );
}
