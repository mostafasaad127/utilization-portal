"use client";

import { useEffect } from "react";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-error-tint text-error">
        <AlertOctagon className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        The page couldn&apos;t be loaded. Try again, and if the problem continues contact the portal team
        {error.digest ? ` quoting reference ${error.digest}` : ""}.
      </p>
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
