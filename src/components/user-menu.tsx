"use client";

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, Settings, Shield } from 'lucide-react';
import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export function UserMenu() {
  const { user, userProfile, signOutUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  // Detectar vista de coach SOLO por pathname (no por rol del perfil)
  // Si está en /coach/... está en vista de coach, si está en /player/... está en vista de jugador
  const inCoachView = pathname === '/coach' || pathname?.startsWith('/coach/');
  const inPlayerView = pathname === '/player' || pathname?.startsWith('/player/');

  useEffect(() => {
    if (!user) return;
    try {
      const q1 = query(collection(db as any, 'messages'), where('toId', '==', user.uid), where('read', '==', false));
      const q2 = query(collection(db as any, 'messages'), where('toCoachDocId', '==', user.uid), where('read', '==', false));
      const unsubs: Array<() => void> = [];
      const update = (snap: any) => {
        setUnreadCount(prev => {
          // No tenemos el total de la otra sub, así que sumamos tamaños cuando llegan
          // En práctica, ambos streams se mezclarán; para simplificar, recalculamos a partir de estados parciales no persistentes.
          // Alternativamente, podríamos hacer dos contadores separados y sumarlos.
          return undefined as any;
        });
      };
      // Implementar dos contadores independientes y sumarlos
      let c1 = 0, c2 = 0;
      unsubs.push(onSnapshot(q1, (snap) => { c1 = snap.size; setUnreadCount(c1 + c2); }, (error) => {
        console.error('Error en listener de mensajes no leídos (q1):', error);
      }));
      unsubs.push(onSnapshot(q2, (snap) => { c2 = snap.size; setUnreadCount(c1 + c2); }, (error) => {
        console.error('Error en listener de mensajes no leídos (q2):', error);
      }));
      return () => { unsubs.forEach(u => u()); };
    } catch (e) {
      console.error('Error suscribiendo a mensajes no leídos:', e);
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOutUser();
    setIsOpen(false);
    window.location.href = '/';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isAdmin = (userProfile as any)?.role === 'admin';

  if (!user) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <a href="/login">Ingresar</a>
        </Button>
        <Button asChild>
          <a href="/register">Registrarse</a>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={userProfile?.avatarUrl} alt={userProfile?.name || user.email || ''} />
            <AvatarFallback>
              {userProfile?.name ? getInitials(userProfile.name) : user.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] h-4 min-w-4 px-1">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {userProfile?.name || user.displayName || 'Usuario'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {isAdmin ? <Shield className="h-3 w-3" /> : (inCoachView ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />)}
              {isAdmin ? 'Admin' : (inCoachView ? 'Entrenador' : (inPlayerView ? 'Jugador' : ((userProfile as any)?.role === 'coach' ? 'Entrenador' : 'Jugador')))}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild>
            <a href="/admin" className="cursor-pointer">
              <Shield className="mr-2 h-4 w-4" />
              Admin
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => { window.location.href = inCoachView ? '/coach/dashboard' : '/player/dashboard'; }} className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { try { localStorage.setItem('preferredRole', inCoachView ? 'coach' : 'player'); } catch {}; window.location.href = inCoachView ? '/coach/profile' : '/player/profile'; }} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Configuración
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
