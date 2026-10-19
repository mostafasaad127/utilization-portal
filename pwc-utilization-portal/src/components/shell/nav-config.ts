import type { AppRole } from "@/lib/auth-policy";

export type NavItem = {
  href: string;
  label: string;
  /** Label shown to employees, whose views are scoped to their own work. */
  employeeLabel?: string;
  icon: "dashboard" | "projects" | "people" | "utilization" | "risks" | "users" | "reference" | "import" | "audit" | "profile" | "join";
  only?: AppRole;
};

export const NAV_SECTIONS: { label?: string; only?: AppRole; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Dashboard", employeeLabel: "My dashboard", icon: "dashboard" },
      { href: "/projects", label: "Projects", employeeLabel: "My projects", icon: "projects" },
      { href: "/projects/join", label: "Join a project", icon: "join", only: "EMPLOYEE" },
      { href: "/people", label: "People", icon: "people", only: "ADMIN" },
      { href: "/utilization", label: "Utilization", icon: "utilization", only: "ADMIN" },
      { href: "/risks", label: "Risk register", employeeLabel: "My risks", icon: "risks" },
      { href: "/me", label: "My profile", icon: "profile", only: "EMPLOYEE" },
    ],
  },
  {
    label: "Administration",
    only: "ADMIN",
    items: [
      { href: "/admin/users", label: "Users & roles", icon: "users" },
      { href: "/admin/reference", label: "Reference data", icon: "reference" },
      { href: "/admin/import", label: "Import spreadsheet", icon: "import" },
      { href: "/admin/audit", label: "Audit log", icon: "audit" },
    ],
  },
];
