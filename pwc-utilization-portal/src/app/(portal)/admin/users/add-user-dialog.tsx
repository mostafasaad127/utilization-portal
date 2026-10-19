"use client";

import { useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { Field, FormAlert, Input, Select } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { GRADE_LABEL, GRADES, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/labels";
import type { FormState } from "@/lib/validation";
import { inviteUser, revokeInvitation } from "../actions";

type Option = { id: string; name: string };

export function AddUserDialog({
  territories,
  capabilities,
  allowedDomains,
}: {
  territories: Option[];
  capabilities: Option[];
  allowedDomains: string[];
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const { state, pending, formRef, onSubmit } = useFormAction((prev: FormState, fd: FormData) => inviteUser(prev, fd), {
    resetOnSuccess: true,
    onSuccess: (s) => {
      setNotice(s.message);
      setOpen(false);
    },
  });
  const fe = state.fieldErrors ?? {};

  return (
    <div className="flex flex-col items-end gap-2">
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setNotice(undefined);
        }}
        title="Add user"
        description="Give someone access before they first sign in. They're added to the resource pool now, so they can be staffed straight away."
        size="lg"
        trigger={
          <Button>
            <UserPlus className="size-4" aria-hidden /> Add user
          </Button>
        }
      >
        <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          {state.error && (
            <div className="sm:col-span-2">
              <FormAlert tone="error">{state.error}</FormAlert>
            </div>
          )}
          <Field label="Full name" htmlFor="u-name" required error={fe.name}>
            <Input id="u-name" name="name" maxLength={120} autoComplete="off" aria-invalid={!!fe.name} />
          </Field>
          <Field label="PwC email" htmlFor="u-email" required error={fe.email} hint={`Must be ${allowedDomains.map((d) => `@${d}`).join(" or ")}`}>
            <Input id="u-email" name="email" type="email" maxLength={254} autoComplete="off" aria-invalid={!!fe.email} />
          </Field>

          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm text-body">
              Role <span className="text-error">*</span>
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["EMPLOYEE", "ADMIN"] as const).map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer gap-3 rounded-md p-3 shadow-[inset_0_0_0_1px_var(--ap-border-input)] has-[:checked]:bg-primary-tint has-[:checked]:shadow-[inset_0_0_0_2px_var(--ap-primary)]"
                >
                  <input type="radio" name="role" value={r} defaultChecked={r === "EMPLOYEE"} className="mt-1 accent-[var(--ap-primary)]" />
                  <span>
                    <span className="block text-sm font-medium text-heading">{ROLE_LABEL[r]}</span>
                    <span className="block text-xs text-muted">{ROLE_DESCRIPTION[r]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Primary capability" htmlFor="u-cap">
            <Select id="u-cap" name="primaryCapabilityId" defaultValue="">
              <option value="">Not set</option>
              {capabilities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Grade" htmlFor="u-grade">
            <Select id="u-grade" name="grade" defaultValue="">
              <option value="">Not set</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {GRADE_LABEL[g]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Territory" htmlFor="u-territory">
            <Select id="u-territory" name="territoryId" defaultValue="">
              <option value="">Not set</option>
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex justify-end gap-3 sm:col-span-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Add user
            </Button>
          </div>
        </form>
      </Dialog>
      {notice && (
        <p role="status" className="max-w-md text-right text-sm text-success">
          {notice}
        </p>
      )}
    </div>
  );
}

export function RevokeInvitationButton({ id, email }: { id: string; email: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col items-end">
      <IconButton
        label={`Revoke invitation for ${email}`}
        disabled={pending}
        className="hover:bg-error-tint hover:text-error"
        onClick={() =>
          start(async () => {
            const r = await revokeInvitation(id);
            setError(r.error);
          })
        }
      >
        <X className="size-4" />
      </IconButton>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
