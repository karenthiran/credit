"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  Users,
  Banknote,
  FileText,
  TrendingUp,
  Settings,
  LogOut,
  Trash2,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const menu = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Collections", href: "/collections", icon: FileText },
  { title: "Loans", href: "/loans", icon: Banknote },
  { title: "Profits", href: "/profits", icon: TrendingUp },
  { title: "Settings", href: "/settings", icon: Settings },
  // { title: "Recycle Bin", href: "/recycle-bin", icon: Trash2 },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [role, setRole] = useState<"admin" | "officer" | null>(null);

  useEffect(() => {
    async function loadUserRole() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();

        if (!response.ok || !data.success) {
          setRole(null);
          return;
        }

        setRole(data.user?.role ?? null);
      } catch {
        setRole(null);
      }
    }

    void loadUserRole();
  }, []);

  const visibleMenu =
    role === "officer"
      ? menu.filter((item) => item.href === "/collections")
      : menu;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (isMobile) {
    return (
      <>
        <div className="border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
          <Image
            src="/AYC_LOGO.png"
            alt="AYC Logo"
            width={96}
            height={28}
            priority
            className="h-auto w-24 max-w-full object-contain"
          />
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
          <div className="flex min-w-0 gap-1 overflow-x-auto px-2 py-2">
            {visibleMenu.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon size={18} />
                  <span className="truncate">{item.title}</span>
                </Link>
              );
            })}

            <button
              type="button"
              onClick={handleLogout}
              className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </>
    );
  }

  return (
    <Sidebar>
      {/* BRAND */}
      <SidebarContent>
        <div className="px-4 py-4">
          <Image
            src="/AYC_LOGO.png"
            alt="AYC Logo"
            width={50}
            height={5}
            priority
            className="h-auto w-20 max-w-full object-contain"
          />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="flex flex-col gap-4">
              {visibleMenu.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href} className="flex items-center gap-2">
                      <item.icon size={18} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter>
        <div className="space-y-3 border-t p-4">
          <Button
            type="button"
            variant="destructive"
            className="w-full justify-start gap-2 cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Logout
          </Button>

          <div className="text-xs text-muted-foreground">
            v1.0 • Loan Management System
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
