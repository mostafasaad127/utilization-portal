import Link from "next/link";
import { ShieldX } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-error-tint text-error">
        <ShieldX className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl">You don&apos;t have access to this page</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        Your role doesn&apos;t include this area. If you need access, ask a portal administrator to update your role.
      </p>
      <Link href="/" className={buttonClass("secondary", "md", "mt-8")}>
        Back to dashboard
      </Link>
    </div>
  );
}
