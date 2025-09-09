
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

export function SidebarMenuContents() {
  const pathname = usePathname();

  const isActive = (path: string, exact: boolean = false) => {
    if (exact) return pathname === path;
    // For root, do exact match. For others, startsWith.
    return path === '/' ? pathname === path : pathname.startsWith(path);
  };
  
  const isCoachView = pathname === '/coach' || pathname.startsWith('/coach/');
  const isAdminView = pathname === '/admin' || pathname.startsWith('/admin/');
  const isPlayerView = !isCoachView && !isAdminView;

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
        <SidebarMenuButton
          asChild
          isActive={isActive("/upload")}
          tooltip="Analizar Lanzamiento"
        >
          <Link href="/upload">
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
    </>
  )
    
  if (isCoachView) return <CoachMenu />;
  if (isAdminView) return <AdminMenu />;
  return <PlayerMenu />;
}
