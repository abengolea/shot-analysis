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
  PanelLeft,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { SidebarMenuContents } from "./sidebar-menu-contents";
import { UserMenu } from "./user-menu";
import { useState, useEffect } from "react";


export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const publicRoutes = ["/", "/login", "/register"];
  const isPublicRoute = publicRoutes.includes(pathname);

  if (!mounted) {
    // On the server and during initial client hydration, render a consistent structure
    // to avoid hydration mismatches. We can show a loader here if we want.
    return <div className="flex-1">{children}</div>;
  }
  
  if (isPublicRoute) {
    return <div className="flex flex-1 flex-col">{children}</div>;
  }
  
  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" asChild>
              <Link href="/">
                <img src="/chas-logo.svg" alt="chas.com logo" className="h-7 w-auto" />
              </Link>
            </Button>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <h2 className="font-headline text-lg font-semibold tracking-tight uppercase">
                chas.com
              </h2>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuContents />
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarSeparator />
          <div className="p-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:px-1">
            <div className="text-center text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              chas.com v1.0
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
          <SidebarTrigger />
          <div className="flex-1">
            {/* Can add breadcrumbs or page title here */}
          </div>
          <UserMenu />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
