import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { fiscalYearOf } from "@/lib/domain/fiscal-year";
import { requireUser } from "@/lib/session";
import { env } from "@/lib/env";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const store = await cookies();
  const mode = store.get("pwc-up-mode")?.value === "dark" ? "dark" : "light";
  const navCollapsed = store.get("pwc-up-nav")?.value === "collapsed";

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      mode={mode}
      navCollapsed={navCollapsed}
      fiscalYearLabel={fiscalYearOf(new Date()).label}
      demo={env.demoMode}
    >
      {children}
    </AppShell>
  );
}
