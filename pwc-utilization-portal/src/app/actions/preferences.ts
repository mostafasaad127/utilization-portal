"use server";

import { cookies } from "next/headers";
import { requireUser } from "@/lib/session";

export async function setColorMode(mode: "light" | "dark") {
  await requireUser();
  if (mode !== "light" && mode !== "dark") return;
  (await cookies()).set("pwc-up-mode", mode, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function setNavCollapsed(collapsed: boolean) {
  await requireUser();
  (await cookies()).set("pwc-up-nav", collapsed ? "collapsed" : "expanded", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}
