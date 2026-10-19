"use client";

import { Dialog as RDialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Appkit 4 modal: centred container, 8px radius, high elevation, title + close. */
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  size = "md",
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <RDialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md bg-container shadow-high focus:outline-none",
            size === "sm" && "max-w-md",
            size === "md" && "max-w-xl",
            size === "lg" && "max-w-3xl",
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
            <div>
              <RDialog.Title className="text-xl font-medium text-heading">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-1 text-sm text-muted">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close className="rounded-sm p-1.5 text-muted hover:bg-hover hover:text-heading" aria-label="Close">
              <X className="size-5" />
            </RDialog.Close>
          </div>
          <div className="px-6 pt-2 pb-6">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export const DialogClose = RDialog.Close;
