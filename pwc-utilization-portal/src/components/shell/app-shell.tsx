"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DropdownMenu } from "radix-ui";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  Database,
  FileSpreadsheet,
  FolderKanban,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  UserCircle,
  UserPlus,
  Sun,
  Users,
  X,
} from "lucide-react";
import { PwcLogo } from "@/components/brand/logo";
import { NAV_SECTIONS, type NavItem } from "@/components/shell/nav-config";
import type { AppRole } from "@/lib/auth-policy";
import { authClient } from "@/lib/auth-client";
import { setColorMode, setNavCollapsed } from "@/app/actions/preferences";
import { ROLE_LABEL } from "@/lib/labels";
import { cn, initials } from "@/lib/utils";

const ICONS: Record<NavItem["icon"], React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  people: Users,
  utilization: BarChart3,
  risks: AlertTriangle,
  users: ShieldCheck,
  reference: Database,
  import: FileSpreadsheet,
  audit: History,
  profile: UserCircle,
  join: UserPlus,
};

type ShellUser = { name: string; email: string; role: AppRole };

export function AppShell({
  user,
  mode,
  navCollapsed,
  fiscalYearLabel,
  demo = false,
  children,
}: {
  user: ShellUser;
  mode: "light" | "dark";
  navCollapsed: boolean;
  fiscalYearLabel: string;
  /** Hosted demo (no SSO yet): show a persistent banner so nobody mistakes it for production. */
  demo?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(navCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    void setNavCollapsed(next);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {demo && (
        <div role="note" className="bg-[#2d3c66] px-4 py-1.5 text-center text-xs font-medium text-white">
          Demo environment with sample data. Don&apos;t enter real client or personal information.
        </div>
      )}
      <a
        href="#main"
        className="sr-only z-50 rounded-sm bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <Header user={user} mode={mode} fiscalYearLabel={fiscalYearLabel} onOpenMobileNav={() => setMobileOpen(true)} />

      <div className="flex flex-1">
        {/* Desktop navigation */}
        <nav
          aria-label="Primary"
          className={cn(
            "sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col border-r border-line bg-container transition-[width] duration-200 lg:flex",
            collapsed ? "w-[72px]" : "w-[264px]",
          )}
        >
          <NavList pathname={pathname} role={user.role} collapsed={collapsed} />
          <div className="mt-auto border-t border-line p-3">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex h-10 w-full items-center gap-3 rounded-sm px-3 text-sm text-muted hover:bg-hover hover:text-heading"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              {collapsed ? <ChevronsRight className="size-5" /> : <ChevronsLeft className="size-5" />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </nav>

        {/* Mobile navigation drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <nav aria-label="Primary" className="absolute inset-y-0 left-0 flex w-72 flex-col bg-container shadow-high">
              <div className="flex h-16 items-center justify-between border-b border-line px-4">
                <PwcLogo className="h-8 text-heading" />
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-sm p-2 hover:bg-hover">
                  <X className="size-5" />
                </button>
              </div>
              <NavList pathname={pathname} role={user.role} collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </nav>
          </div>
        )}

        <main id="main" className="min-w-0 flex-1" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

function Header({
  user,
  mode,
  fiscalYearLabel,
  onOpenMobileNav,
}: {
  user: ShellUser;
  mode: "light" | "dark";
  fiscalYearLabel: string;
  onOpenMobileNav: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-container px-4 lg:px-6">
      <button type="button" onClick={onOpenMobileNav} className="rounded-sm p-2 hover:bg-hover lg:hidden" aria-label="Open navigation">
        <Menu className="size-5" />
      </button>
      <Link href="/" className="flex items-center gap-4" aria-label="Utilization Portal home">
        <PwcLogo className="h-9 text-heading" />
        <span className="hidden h-7 w-px bg-line sm:block" aria-hidden />
        <span className="hidden text-lg font-medium text-heading sm:block">Utilization Portal</span>
      </Link>

      <div className="ml-auto flex items-center gap-3">
      <form
        role="search"
        className="hidden md:block"
        onSubmit={(e) => {
          e.preventDefault();
          const q = query.trim();
          if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
        }}
      >
        <label className="relative block">
          <span className="sr-only">Search projects, clients and people</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={user.role === "ADMIN" ? "Search projects, clients, people" : "Search your projects"}
            className="h-9 w-72 rounded-md bg-container-alt pr-3 pl-9 text-sm text-heading placeholder:text-muted focus-visible:shadow-[inset_0_0_0_2px_var(--ap-primary)] focus:outline-none lg:w-80"
          />
        </label>
      </form>

      <span className="hidden items-center gap-1.5 rounded-sm bg-primary-tint px-2.5 py-1 text-xs font-medium text-primary sm:inline-flex">
        <Building2 className="size-3.5" aria-hidden /> {fiscalYearLabel} current
      </span>

      <UserMenu user={user} mode={mode} />
      </div>
    </header>
  );
}

function UserMenu({ user, mode }: { user: ShellUser; mode: "light" | "dark" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex items-center gap-2 rounded-full p-0.5 hover:bg-hover data-[state=open]:bg-hover"
        aria-label={`Account menu for ${user.name}`}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
          {initials(user.name)}
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-72 rounded-md bg-container p-2 text-sm shadow-high outline-none"
        >
          <div className="px-3 py-2">
            <p className="font-medium text-heading">{user.name}</p>
            <p className="truncate text-muted">{user.email}</p>
            <span className="mt-2 inline-flex rounded-sm bg-container-alt px-2 py-0.5 text-xs text-body">
              {ROLE_LABEL[user.role]}
            </span>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-body outline-none data-[highlighted]:bg-hover"
            onSelect={(e) => {
              e.preventDefault();
              startTransition(async () => {
                await setColorMode(mode === "dark" ? "light" : "dark");
                router.refresh();
              });
            }}
            disabled={pending}
          >
            {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {mode === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-body outline-none data-[highlighted]:bg-hover"
            onSelect={async () => {
              await authClient.signOut();
              router.replace("/sign-in");
              router.refresh();
            }}
          >
            <LogOut className="size-4" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function NavList({
  pathname,
  role,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  role: AppRole;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
      {NAV_SECTIONS.filter((s) => !s.only || s.only === role).map((section, i) => (
        <div key={i} className={cn(i > 0 && "mt-6")}>
          {section.label &&
            (collapsed ? (
              <div className="mx-3 mb-2 h-px bg-line" aria-hidden />
            ) : (
              <p className="mb-2 px-3 text-xs font-medium tracking-wide text-muted uppercase">{section.label}</p>
            ))}
          <ul className="flex flex-col gap-1">
            {section.items.filter((item) => !item.only || item.only === role).map((item) => {
              const Icon = ICONS[item.icon];
              const label = role === "EMPLOYEE" && item.employeeLabel ? item.employeeLabel : item.label;
              // The most specific matching item wins (e.g. /projects/join over /projects).
              const matches = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
              const moreSpecific = section.items.some((o) => o.href !== item.href && o.href.startsWith(`${item.href}/`) && matches(o.href) && (!o.only || o.only === role));
              const active = matches(item.href) && !moreSpecific;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "relative flex h-10 items-center gap-3 rounded-sm px-3 text-sm transition-colors",
                      active ? "bg-primary-tint font-medium text-primary" : "text-body hover:bg-hover hover:text-heading",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-sm bg-primary" aria-hidden />}
                    <Icon className="size-5 shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
