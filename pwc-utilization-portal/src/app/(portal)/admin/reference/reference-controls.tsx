"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { Field, FormAlert, Input, Select } from "@/components/ui/form";
import { GRADE_LABEL, GRADES } from "@/lib/labels";
import type { FormState } from "@/lib/validation";
import { createReference, savePerson, setPersonActive, toggleReference } from "../actions";

type Option = { id: string; name: string };
type Kind = "client" | "industry" | "lineOfService" | "capability";

export function AddReferenceForm({ kind, industries, territories }: { kind: Kind; industries?: Option[]; territories?: Option[] }) {
  const { state, pending, formRef, onSubmit } = useFormAction(
    (prev: FormState, fd: FormData) => createReference(kind, prev, fd),
    { resetOnSuccess: true },
  );
  const fe = state.fieldErrors ?? {};

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
      {kind === "capability" && (
        <Field label="Code" htmlFor={`${kind}-code`} error={fe.code} className="w-28">
          <Input id={`${kind}-code`} name="code" maxLength={10} placeholder="BA" />
        </Field>
      )}
      <Field label="Name" htmlFor={`${kind}-name`} error={fe.name} className="min-w-[16rem] flex-1">
        <Input id={`${kind}-name`} name="name" maxLength={200} />
      </Field>
      {kind === "client" && industries && (
        <Field label="Industry" htmlFor="client-industry" className="w-56">
          <Select id="client-industry" name="industryId" defaultValue="">
            <option value="">Not set</option>
            {industries.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {kind === "lineOfService" && territories && (
        <Field label="Territory" htmlFor="los-territory" error={fe.territoryId} className="w-48">
          <Select id="los-territory" name="territoryId" defaultValue={territories[0]?.id}>
            {territories.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Button type="submit" loading={pending}>
        <Plus className="size-4" aria-hidden /> Add
      </Button>
      {state.error && <p className="w-full text-sm text-error">{state.error}</p>}
      {state.ok && state.message && <p className="w-full text-sm text-success" role="status">{state.message}</p>}
    </form>
  );
}

export function ArchiveToggle({ kind, id, isActive }: { kind: Kind | "person"; id: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <IconButton
      label={isActive ? "Archive" : "Restore"}
      disabled={pending}
      onClick={() => start(async () => void (kind === "person" ? await setPersonActive(id, !isActive) : await toggleReference(kind, id, !isActive)))}
    >
      {isActive ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}
    </IconButton>
  );
}

export type PersonValues = {
  id: string;
  name: string;
  email: string | null;
  grade: string | null;
  territoryId: string | null;
  primaryCapabilityId: string | null;
};

export function PersonDialog({ existing, territories, capabilities }: { existing?: PersonValues; territories: Option[]; capabilities: Option[] }) {
  const [open, setOpen] = useState(false);
  const { state, pending, formRef, onSubmit } = useFormAction(
    (prev: FormState, fd: FormData) => savePerson(existing?.id ?? null, prev, fd),
    { onSuccess: () => setOpen(false) },
  );
  const fe = state.fieldErrors ?? {};

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={existing ? `Edit ${existing.name}` : "Add person"}
      description="People in the resource pool can be assigned to projects. A matching email links them to their portal login."
      trigger={
        existing ? (
          <IconButton label={`Edit ${existing.name}`}>
            <Pencil className="size-4" />
          </IconButton>
        ) : (
          <Button size="sm">
            <Plus className="size-4" aria-hidden /> Add person
          </Button>
        )
      }
    >
      <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        {state.error && (
          <div className="sm:col-span-2">
            <FormAlert tone="error">{state.error}</FormAlert>
          </div>
        )}
        <Field label="Full name" htmlFor="p-name" required error={fe.name}>
          <Input id="p-name" name="name" defaultValue={existing?.name} maxLength={120} />
        </Field>
        <Field label="PwC email" htmlFor="p-email" error={fe.email}>
          <Input id="p-email" name="email" type="email" defaultValue={existing?.email ?? ""} maxLength={254} />
        </Field>
        <Field label="Grade" htmlFor="p-grade">
          <Select id="p-grade" name="grade" defaultValue={existing?.grade ?? ""}>
            <option value="">Not set</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {GRADE_LABEL[g]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Territory" htmlFor="p-territory">
          <Select id="p-territory" name="territoryId" defaultValue={existing?.territoryId ?? ""}>
            <option value="">Not set</option>
            {territories.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Primary capability" htmlFor="p-cap" className="sm:col-span-2">
          <Select id="p-cap" name="primaryCapabilityId" defaultValue={existing?.primaryCapabilityId ?? ""}>
            <option value="">Not set</option>
            {capabilities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-3 sm:col-span-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" loading={pending}>
            {existing ? "Save" : "Add person"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
