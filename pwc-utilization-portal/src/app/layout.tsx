import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Utilization Portal | PwC", template: "%s | Utilization Portal" },
  description: "Projects, team allocation and utilization for PwC Tech Catalyst and Digital Consulting teams.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#d04a02",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const mode = (await cookies()).get("pwc-up-mode")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="en-GB" data-mode={mode} data-theme="orange" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
