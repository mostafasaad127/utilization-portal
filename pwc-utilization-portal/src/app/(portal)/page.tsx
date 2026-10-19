import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { isAdmin } from "@/lib/access";
import { TeamDashboard } from "./_dashboard/team-dashboard";
import { MyDashboard } from "./_dashboard/my-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

/** Admins get the team-wide dashboard; employees only ever see their own figures. */
export default async function DashboardPage() {
  const user = await requireUser();
  return isAdmin(user) ? <TeamDashboard user={user} /> : <MyDashboard user={user} />;
}
