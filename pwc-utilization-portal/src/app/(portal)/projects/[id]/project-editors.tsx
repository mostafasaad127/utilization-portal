"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { Field, FormAlert, Input, Select, Textarea } from "@/components/ui/form";
import { RAG_LABEL, RAGS, RISK_STATUS_LABEL, RISK_STATUSES, SEVERITIES, SEVERITY_LABEL } from "@/lib/labels";
import type { FormState } from "@/lib/validation";
import { deleteProject, deleteRisk, postUpdate, removeAssignment, saveAssignment, saveRisk } from "../actions";

type Option = { id: string; name: string };

// ── Team ────────────────────────────────────────────────────────────────────

export type AssignmentValues = {
  id: string;
  personId: string;
  capabilityId: string | null;
  allocation: number;
  startDate: string;
  endDate: string;
  note: string | null;
};

export function AssignmentDialog({
  projectId,
  people,
  capabilities,
  defaults,
  existing,
  selfOnly = false,
  triggerLabel,
}: {
  projectId: string;
  people: Option[];
  capabilities: Option[];
  defaults: { startDate: string; endDate: string; capabilityId?: string | null };
  existing?: AssignmentValues;
  /** Employees book only themselves: no person picker (the server enforces this too). */
  selfOnly?: boolean;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const { state, pending, formRef, onSubmit } = useFormAction(
    (prev: FormState, fd: FormData) => saveAssignment(projectId, existing?.id ?? null, prev, fd),
    { onSuccess: () => setOpen(false) },
  );
  const fe = state.fieldErrors ?? {};

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={existing ? (selfOnly ? "Edit your assignment" : "Edit assignment") : selfOnly ? (triggerLabel ?? "Add your time") : "Add team member"}
      description={selfOnly ? "Allocation is the share of your time booked to this project." : "Allocation is the share of the person's capacity booked to this project."}
      trigger={
        existing ? (
          <IconButton label="Edit assignment">
            <Pencil className="size-4" />
          </IconButton>
        ) : (
          <Button variant={selfOnly && !triggerLabel ? "secondary" : selfOnly ? "primary" : "secondary"} size="sm">
            <Plus className="size-4" aria-hidden /> {triggerLabel ?? (selfOnly ? "Add your time" : "Add team member")}
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
        {!selfOnly && (
          <Field label="Person" htmlFor="personId" required error={fe.personId} className="sm:col-span-2">
            <Select id="personId" name="personId" defaultValue={existing?.personId ?? ""} aria-invalid={!!fe.personId}>
              <option value="">Select a person</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Capability" htmlFor="capabilityId">
          <Select id="capabilityId" name="capabilityId" defaultValue={existing?.capabilityId ?? defaults.capabilityId ?? ""}>
            <option value="">Not set</option>
            {capabilities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Allocation %" htmlFor="allocation" required error={fe.allocation}>
          <Input
            id="allocation"
            name="allocation"
            type="number"
            min={1}
            max={200}
            step={5}
            defaultValue={existing?.allocation ?? 100}
            aria-invalid={!!fe.allocation}
          />
        </Field>
        <Field label="Start date" htmlFor="a-start" required error={fe.startDate}>
          <Input id="a-start" name="startDate" type="date" defaultValue={existing?.startDate ?? defaults.startDate} />
        </Field>
        <Field label="End date" htmlFor="a-end" hint="Blank = until the project ends" error={fe.endDate}>
          <Input id="a-end" name="endDate" type="date" defaultValue={existing?.endDate ?? defaults.endDate} />
        </Field>
        <Field label="Note" htmlFor="a-note" className="sm:col-span-2">
          <Input id="a-note" name="note" defaultValue={existing?.note ?? ""} maxLength={500} placeholder="Role on the project, e.g. Lead BA" />
        </Field>
        <div className="flex justify-end gap-3 sm:col-span-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" loading={pending}>
            {existing ? "Save" : selfOnly ? "Add me" : "Add to team"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function RemoveAssignmentButton({ projectId, assignmentId, name }: { projectId: string; assignmentId: string; name: string }) {
  return (
    <ConfirmButton
      label={`Remove ${name}`}
      title={`Remove ${name} from the team?`}
      description="Their allocation on this project will be deleted. This is recorded in the audit log."
      confirmLabel="Remove"
      onConfirm={() => removeAssignment(projectId, assignmentId)}
    />
  );
}

// ── Risks ───────────────────────────────────────────────────────────────────

export type RiskValues = { id: string; title: string; mitigation: string | null; severity: string; status: string; owner: string | null };

export function RiskDialog({ projectId, existing }: { projectId: string; existing?: RiskValues }) {
  const [open, setOpen] = useState(false);
  const { state, pending, formRef, onSubmit } = useFormAction(
    (prev: FormState, fd: FormData) => saveRisk(projectId, existing?.id ?? null, prev, fd),
    { onSuccess: () => setOpen(false) },
  );
  const fe = state.fieldErrors ?? {};

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={existing ? "Edit risk" : "Raise a risk"}
      trigger={
        existing ? (
          <IconButton label="Edit risk">
            <Pencil className="size-4" />
          </IconButton>
        ) : (
          <Button variant="secondary" size="sm">
            <Plus className="size-4" aria-hidden /> Raise a risk
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
        <Field label="Risk or challenge" htmlFor="r-title" required error={fe.title} className="sm:col-span-2">
          <Textarea id="r-title" name="title" rows={2} defaultValue={existing?.title} maxLength={500} aria-invalid={!!fe.title} />
        </Field>
        <Field label="Severity" htmlFor="r-sev" required>
          <Select id="r-sev" name="severity" defaultValue={existing?.severity ?? "MEDIUM"}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="r-status" required>
          <Select id="r-status" name="status" defaultValue={existing?.status ?? "OPEN"}>
            {RISK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RISK_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Owner" htmlFor="r-owner" className="sm:col-span-2">
          <Input id="r-owner" name="owner" defaultValue={existing?.owner ?? ""} maxLength={120} />
        </Field>
        <Field label="Mitigation" htmlFor="r-mit" className="sm:col-span-2">
          <Textarea id="r-mit" name="mitigation" rows={3} defaultValue={existing?.mitigation ?? ""} maxLength={2000} />
        </Field>
        <div className="flex justify-end gap-3 sm:col-span-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" loading={pending}>
            {existing ? "Save" : "Add risk"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function DeleteRiskButton({ projectId, riskId }: { projectId: string; riskId: string }) {
  return (
    <ConfirmButton
      label="Delete risk"
      title="Delete this risk?"
      description="Prefer closing a risk to keep its history. Deletion is recorded in the audit log."
      confirmLabel="Delete"
      onConfirm={() => deleteRisk(projectId, riskId)}
    />
  );
}

// ── Status update ───────────────────────────────────────────────────────────

export function UpdateForm({ projectId, currentRag }: { projectId: string; currentRag: string }) {
  const { state, pending, formRef, onSubmit } = useFormAction(
    (prev: FormState, fd: FormData) => postUpdate(projectId, prev, fd),
    { resetOnSuccess: true },
  );
  const fe = state.fieldErrors ?? {};

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state.ok && state.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <Field label="Status update" htmlFor="u-body" required error={fe.body}>
        <Textarea
          id="u-body"
          name="body"
          rows={3}
          maxLength={4000}
          placeholder="Progress since the last update, upcoming milestones, blockers…"
          aria-invalid={!!fe.body}
        />
      </Field>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="Overall RAG" htmlFor="u-rag" className="w-44">
          <Select id="u-rag" name="rag" defaultValue={currentRag}>
            {RAGS.map((r) => (
              <option key={r} value={r}>
                {RAG_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" loading={pending}>
          Post update
        </Button>
      </div>
    </form>
  );
}

// ── Delete project ──────────────────────────────────────────────────────────

export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title="Delete project?"
      description={`“${name}” will be removed from all views. Admins can restore it from the database; the deletion is audited.`}
      trigger={
        <Button variant="tertiary" className="text-error hover:bg-error-tint">
          <Trash2 className="size-4" aria-hidden /> Delete
        </Button>
      }
    >
      <div className="flex justify-end gap-3">
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button variant="negative" loading={pending} onClick={() => start(() => deleteProject(projectId))}>
          Delete project
        </Button>
      </div>
    </Dialog>
  );
}

// ── Shared confirm ──────────────────────────────────────────────────────────

function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<FormState>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title={title}
      description={description}
      trigger={
        <IconButton label={label} className="hover:bg-error-tint hover:text-error">
          <Trash2 className="size-4" />
        </IconButton>
      }
    >
      {error && (
        <div className="mb-4">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      )}
      <div className="flex justify-end gap-3">
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button
          variant="negative"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await onConfirm();
              if (r.error) setError(r.error);
              else setOpen(false);
            })
          }
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
