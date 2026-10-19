import { requireRole } from "@/lib/session";

/** Every admin page requires the Admin role; each admin action re-checks it as well. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");
  return children;
}
