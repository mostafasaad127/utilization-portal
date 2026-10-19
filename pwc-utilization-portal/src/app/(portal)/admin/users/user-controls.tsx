"use client";

import { useState, useTransition } from "react";
import { LogOut, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { ROLE_LABEL } from "@/lib/labels";
import { revokeSessions, setUserActive, setUserRole } from "../actions";

export function UserControls({ userId, role, isActive, isSelf }: { userId: string; role: string; isActive: boolean; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string }>();

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? { tone: "error", text: r.error } : r.message ? { tone: "ok", text: r.message } : undefined);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Select
          aria-label="Role"
          defaultValue={role}
          disabled={isSelf || pending}
          onChange={(e) => run(() => setUserRole(userId, e.target.value))}
          className="w-32"
        >
          {(["ADMIN", "EMPLOYEE"] as const).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
        <Button variant="tertiary" size="sm" disabled={pending} onClick={() => run(() => revokeSessions(userId))} title="Sign out all sessions">
          <LogOut className="size-4" aria-hidden />
          <span className="sr-only">Sign out all sessions</span>
        </Button>
        {!isSelf &&
          (isActive ? (
            <Button variant="tertiary" size="sm" className="text-error hover:bg-error-tint" disabled={pending} onClick={() => run(() => setUserActive(userId, false))}>
              <UserX className="size-4" aria-hidden /> Revoke
            </Button>
          ) : (
            <Button variant="tertiary" size="sm" disabled={pending} onClick={() => run(() => setUserActive(userId, true))}>
              <UserCheck className="size-4" aria-hidden /> Restore
            </Button>
          ))}
      </div>
      {msg && (
        <p role="status" className={msg.tone === "error" ? "text-xs text-error" : "text-xs text-success"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
