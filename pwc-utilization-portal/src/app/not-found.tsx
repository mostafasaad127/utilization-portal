import Link from "next/link";
import { PwcLogo } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6 text-center">
      <PwcLogo className="h-10 text-heading" />
      <p className="mt-10 text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-3xl">We can&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-sm text-muted">It may have been moved or deleted, or the link may be incorrect.</p>
      <Link href="/" className={buttonClass("primary", "md", "mt-8")}>
        Back to dashboard
      </Link>
    </div>
  );
}
