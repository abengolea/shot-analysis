"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusSquare,
  Users,
  Search,
  Shield,
  User,
  ChevronDown,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BasketballIcon } from "@/components/icons";
import { useState } from "react";
import { mockPlayers } from "@/lib/mock-data";

type Role = "player" | "coach";

const player = mockPlayers[0];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>("player");

  const isActive = (path: string) => {
    return pathname === path;
  };

  const PlayerMenu = () => (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive("/")} tooltip="Mi Panel">
          <Link href="/">
            <LayoutDashboard />
            Mi Panel
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive("/analysis/new")}
          tooltip="Analizar Tiro"
        >
          <Link href="/analysis/new">
            <PlusSquare />
            Analizar Tiro
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
          isActive={isActive("/coach/dashboard")}
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
          isActive={pathname.startsWith("/players")}
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

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" asChild>
              <Link href="/">
                <BasketballIcon className="text-primary" />
              </Link>
            </Button>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <h2 className="font-headline text-lg font-semibold tracking-tight">
                ShotVision AI
              </h2>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {role === "player" ? <PlayerMenu /> : <CoachMenu />}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarSeparator />
          <div className="p-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:px-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start p-2 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                       <AvatarImage src={player.avatarUrl} alt={player.name} />
                      <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start group-data-[collapsible=icon]:hidden">
                      <span className="text-sm font-medium leading-none">
                        {player.name}
                      </span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {role === 'player' ? 'Jugador' : 'Entrenador'}
                      </span>
                    </div>
                     <ChevronDown className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mb-2" align="end">
                <DropdownMenuLabel>Cambiar Rol</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRole("player")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Vista de Jugador</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRole("coach")}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Vista de Entrenador</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                 <DropdownMenuItem asChild>
                   <Link href="/admin">
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Admin</span>
                   </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="flex-1">
            {/* Can add breadcrumbs or page title here */}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
