import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export default function PortalNotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-container-alt text-muted">
        <SearchX className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl">We can&apos;t find that</h1>
      <p className="mt-2 max-w-md text-sm text-muted">It may have been deleted, or the link may be incorrect.</p>
      <Link href="/projects" className={buttonClass("secondary", "md", "mt-8")}>
        Go to projects
      </Link>
    </div>
  );
}
