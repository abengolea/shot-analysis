
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  LayoutDashboard,
  PlusSquare,
  Search,
  Users,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import {
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function SidebarMenuContents() {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const router = useRouter();
  const [hasCoachProfile, setHasCoachProfile] = useState(false);
  const [hasPlayerProfile, setHasPlayerProfile] = useState(false);
  const [profileIncompleteOpen, setProfileIncompleteOpen] = useState(false);

  useEffect(() => {
    const checkProfiles = async () => {
      try {
        const uid = (userProfile as any)?.id;
        if (!uid) {
          setHasCoachProfile(false);
          setHasPlayerProfile(false);
          return;
        }
        const [coachDoc, playerDoc] = await Promise.all([
          getDoc(doc(db as any, 'coaches', uid)),
          getDoc(doc(db as any, 'players', uid)),
        ]);
        setHasCoachProfile(coachDoc.exists());
        setHasPlayerProfile(playerDoc.exists());
      } catch (e) {
        console.warn('No se pudo verificar perfiles coach/player:', e);
      }
    };
    checkProfiles();
  }, [userProfile]);

  const isActive = (path: string, exact: boolean = false) => {
    if (exact) return pathname === path;
    // For root, do exact match. For others, startsWith.
    return path === '/' ? pathname === path : pathname.startsWith(path);
  };
  
  const isCoachView = pathname === '/coach' || pathname.startsWith('/coach/');
  const isAdminView = pathname === '/admin' || pathname.startsWith('/admin/');
  const isPlayerView = !isCoachView && !isAdminView;

  const isPlayerProfileComplete = (p: any | null | undefined): boolean => {
    if (!p) return false;
    const hasName = typeof p.name === 'string' && p.name.trim().length > 1;
    const hasDob = Boolean(p.dob);
    const hasCountry = typeof p.country === 'string' && p.country.trim().length > 0;
    const hasAgeGroup = typeof p.ageGroup === 'string' && p.ageGroup.trim().length > 0;
    const hasPlayerLevel = typeof p.playerLevel === 'string' && p.playerLevel.trim().length > 0;
    const hasPosition = typeof p.position === 'string' && p.position.trim().length > 0;
    const heightOk = p.height !== undefined && p.height !== null && !Number.isNaN(Number(p.height)) && Number(p.height) > 0;
    const wingspanOk = p.wingspan !== undefined && p.wingspan !== null && !Number.isNaN(Number(p.wingspan)) && Number(p.wingspan) > 0;
    return hasName && hasDob && hasCountry && hasAgeGroup && hasPlayerLevel && hasPosition && heightOk && wingspanOk;
  };

  const PlayerMenu = () => (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive("/dashboard")} tooltip="Mi Panel">
          <Link href="/dashboard">
            <LayoutDashboard />
            Mi Panel
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive("/support")} tooltip="Soporte">
          <Link href="/support">
            <Shield />
            Soporte
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive("/upload")}
          tooltip="Analizar Lanzamiento"
        >
          <Link
            href="/upload"
            onClick={(e) => {
              if (!isPlayerProfileComplete(userProfile)) {
                e.preventDefault();
                setProfileIncompleteOpen(true);
              }
            }}
          >
            <PlusSquare />
            Analizar Lanzamiento
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive("/coaches")}
          tooltip="Buscar Entrenadores"
        >
          <Link href="/coaches">
            <Search />
            Buscar Entrenadores
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {hasCoachProfile && (
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={false} tooltip="Cambiar a Entrenador">
            <Link href="/coach/dashboard" onClick={() => {
              try { localStorage.setItem('preferredRole', 'coach'); } catch {}
            }}>
              <Users />
              Cambiar a Entrenador
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
    </>
  );

  const CoachMenu = () => (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive("/coach/dashboard", true)}
          tooltip="Panel de Entrenador"
        >
          <Link href="/coach/dashboard">
            <LayoutDashboard />
            Panel
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive("/coach/dashboard")} // No exact match, can be part of players view
          tooltip="Mis Jugadores"
        >
          <Link href="/coach/dashboard">
            <Users />
            Mis Jugadores
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {hasPlayerProfile && (
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={false} tooltip="Cambiar a Jugador">
            <Link href="/dashboard" onClick={() => {
              try { localStorage.setItem('preferredRole', 'player'); } catch {}
            }}>
              <Users />
              Cambiar a Jugador
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
    </>
  );

  const AdminMenu = () => (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={pathname === "/admin" && !pathname.includes("tab=")}
          tooltip="Panel de Admin"
        >
          <Link href="/admin">
            <LayoutDashboard />
            Panel
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={pathname.startsWith("/admin/revision-ia")}
          tooltip="Revisión IA"
        >
          <Link href="/admin/revision-ia">
            <Shield />
            Revisión IA
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={pathname.startsWith("/admin/tickets")}
          tooltip="Tickets"
        >
          <Link href="/admin/tickets">
            <ShieldCheck />
            Tickets
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
       <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={pathname.includes("tab=coaches")}
          tooltip="Entrenadores"
        >
          <Link href="/admin?tab=coaches">
            <ShieldCheck />
            Entrenadores
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
       <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={pathname.includes("tab=players")}
          tooltip="Jugadores"
        >
          <Link href="/admin?tab=players">
            <Users />
            Jugadores
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive("/rankings")}
          tooltip="Rankings Públicos"
        >
          <Link href="/rankings">
            <Trophy />
            Rankings
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  )
    
  if (isCoachView) return <CoachMenu />;
  if (isAdminView) return (userProfile as any)?.role === 'admin' ? <AdminMenu /> : null;
  return (
    <>
      <PlayerMenu />
      <AlertDialog open={profileIncompleteOpen} onOpenChange={setProfileIncompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Completa tu perfil para comenzar</AlertDialogTitle>
            <AlertDialogDescription>
              No podés iniciar un análisis hasta completar tu perfil. Completá tu nombre, fecha de nacimiento, país, grupo de edad, nivel, posición, altura y envergadura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProfileIncompleteOpen(false)}>Cerrar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setProfileIncompleteOpen(false); router.push('/profile'); }}>Ir a mi perfil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
