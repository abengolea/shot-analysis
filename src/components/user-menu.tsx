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
import { LogOut, User, Settings, Shield } from 'lucide-react';

export function UserMenu() {
  const { user, userProfile, signOutUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

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

  const isCoach = userProfile && !('dob' in userProfile);

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
              {isCoach ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {isCoach ? 'Entrenador' : 'Jugador'}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={isCoach ? '/coach/dashboard' : '/dashboard'} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Dashboard
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/profile" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Configuración
          </a>
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
