"use client";

import { useState } from 'react';
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
import { LogOut, User, Settings, Shield, Shuffle } from 'lucide-react';
import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';

export function UserMenu() {
  const { user, userProfile, signOutUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
      unsubs.push(onSnapshot(q1, (snap) => { c1 = snap.size; setUnreadCount(c1 + c2); }));
      unsubs.push(onSnapshot(q2, (snap) => { c2 = snap.size; setUnreadCount(c1 + c2); }));
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

  //

  const [isCoach, setIsCoach] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const id = (userProfile as any)?.id || user?.uid;
        if (!id) { setIsCoach(false); return; }
        // Primero, si el perfil actual declara role=coach, basta
        if ((userProfile as any)?.role === 'coach') { setIsCoach(true); return; }
        const snap = await getDoc(doc(db as any, 'coaches', id));
        if (!cancelled) setIsCoach(snap.exists());
      } catch {
        if (!cancelled) setIsCoach(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [user, userProfile]);
  const isAdmin = (userProfile as any)?.role === 'admin';

  const switchToCoach = () => {
    try { localStorage.setItem('preferredRole', 'coach'); } catch {}
    window.location.href = '/coach/dashboard';
  };

  const switchToPlayer = () => {
    try { localStorage.setItem('preferredRole', 'player'); } catch {}
    window.location.href = '/dashboard';
  };

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
              {isAdmin ? <Shield className="h-3 w-3" /> : (isCoach ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />)}
              {isAdmin ? 'Admin' : (isCoach ? 'Entrenador' : 'Jugador')}
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
        <DropdownMenuItem onClick={() => (isCoach ? switchToCoach() : switchToPlayer())} className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { try { localStorage.setItem('preferredRole', isCoach ? 'coach' : 'player'); } catch {}; window.location.href = '/profile'; }} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Configuración
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isCoach ? (
          <DropdownMenuItem onClick={switchToPlayer} className="cursor-pointer">
            <Shuffle className="mr-2 h-4 w-4" />
            Cambiar a Jugador
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => { window.location.href = '/coach-register'; }} className="cursor-pointer">
            <Shuffle className="mr-2 h-4 w-4" />
            Convertirme en Entrenador
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
