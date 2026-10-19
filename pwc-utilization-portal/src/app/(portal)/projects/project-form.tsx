"use client";

import { useState } from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";
import { Checkbox, Field, FormAlert, Input, Select, Textarea } from "@/components/ui/form";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { RAG_LABEL, RAGS, STATUS_LABEL, STATUSES } from "@/lib/labels";
import type { FormState } from "@/lib/validation";

type Option = { id: string; name: string };
export type ProjectFormDefaults = {
  name?: string;
  clientId?: string;
  industryId?: string | null;
  lineOfServiceId?: string | null;
  territoryId?: string;
  status?: string;
  rag?: string;
  startDate?: string;
  endDate?: string;
  multiTower?: boolean;
  engagementLeads?: string[];
  scope?: string | null;
};

const NEW_CLIENT = "__new__";

export function ProjectForm({
  action,
  defaults = {},
  options,
  cancelHref,
  submitLabel,
  involvement,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: ProjectFormDefaults;
  options: {
    clients: Option[];
    industries: Option[];
    territories: Option[];
    linesOfService: (Option & { territoryId: string })[];
  };
  cancelHref: string;
  submitLabel: string;
  /** New projects only: how the signed-in user is involved. Required for employees, optional for admins. */
  involvement?: { required: boolean; capabilities: Option[]; defaultCapabilityId?: string | null };
}) {
  const [joining, setJoining] = useState(Boolean(involvement?.required));
  const { state, pending, formRef, onSubmit } = useFormAction(action);
  const [clientChoice, setClientChoice] = useState(defaults.clientId ?? "");
  const [territoryId, setTerritoryId] = useState(defaults.territoryId ?? options.territories[0]?.id ?? "");
  const fe = state.fieldErrors ?? {};
  const losForTerritory = options.linesOfService.filter((l) => l.territoryId === territoryId);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}

      <Panel>
        <PanelHeader title="Engagement" description="What the project is and who it is for" />
        <PanelBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Project name" htmlFor="name" required error={fe.name} className="md:col-span-2">
            <Input id="name" name="name" defaultValue={defaults.name} required maxLength={200} aria-invalid={!!fe.name} />
          </Field>

          <Field label="Client" htmlFor="clientId" required error={fe.clientId}>
            <Select
              id="clientId"
              name={clientChoice === NEW_CLIENT ? undefined : "clientId"}
              value={clientChoice}
              onChange={(e) => setClientChoice(e.target.value)}
              aria-invalid={!!fe.clientId}
            >
              <option value="">Select a client</option>
              {options.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CLIENT}>+ Add a new client…</option>
            </Select>
          </Field>
          {clientChoice === NEW_CLIENT ? (
            <Field label="New client name" htmlFor="newClientName" required error={fe.newClientName}>
              <Input id="newClientName" name="newClientName" autoFocus maxLength={200} />
            </Field>
          ) : (
            <Field label="Industry" htmlFor="industryId">
              <Select id="industryId" name="industryId" defaultValue={defaults.industryId ?? ""}>
                <option value="">Not set</option>
                {options.industries.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {clientChoice === NEW_CLIENT && (
            <Field label="Industry" htmlFor="industryId">
              <Select id="industryId" name="industryId" defaultValue={defaults.industryId ?? ""}>
                <option value="">Not set</option>
                {options.industries.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Territory" htmlFor="territoryId" required error={fe.territoryId}>
            <Select id="territoryId" name="territoryId" value={territoryId} onChange={(e) => setTerritoryId(e.target.value)}>
              {options.territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Line of service" htmlFor="lineOfServiceId" hint="Filtered by territory">
            <Select key={territoryId} id="lineOfServiceId" name="lineOfServiceId" defaultValue={defaults.lineOfServiceId ?? ""}>
              <option value="">Not set</option>
              {losForTerritory.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Engagement leads / partners"
            htmlFor="engagementLeads"
            hint="Separate names with commas"
            error={fe.engagementLeads}
            className="md:col-span-2"
          >
            <Input id="engagementLeads" name="engagementLeads" defaultValue={defaults.engagementLeads?.join(", ")} />
          </Field>

          <div className="md:col-span-2">
            <Checkbox name="multiTower" label="Multi-tower engagement" defaultChecked={defaults.multiTower} />
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Timeline & health" />
        <PanelBody className="grid grid-cols-1 gap-5 md:grid-cols-4">
          <Field label="Start date" htmlFor="startDate" required error={fe.startDate}>
            <Input id="startDate" name="startDate" type="date" defaultValue={defaults.startDate} required aria-invalid={!!fe.startDate} />
          </Field>
          <Field label="End date" htmlFor="endDate" hint="Leave blank if TBD" error={fe.endDate}>
            <Input id="endDate" name="endDate" type="date" defaultValue={defaults.endDate} aria-invalid={!!fe.endDate} />
          </Field>
          <Field label="Status" htmlFor="status" required>
            <Select id="status" name="status" defaultValue={defaults.status ?? "ACTIVE"}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="RAG" htmlFor="rag" required>
            <Select id="rag" name="rag" defaultValue={defaults.rag ?? "GREEN"}>
              {RAGS.map((r) => (
                <option key={r} value={r}>
                  {RAG_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
        </PanelBody>
      </Panel>

      {involvement && (
        <Panel>
          <PanelHeader
            title="Your involvement"
            description={
              involvement.required
                ? "You'll be added to the team for the project dates. You can adjust your own dates later."
                : "Add yourself to the team if you're staffed on this project."
            }
          />
          <PanelBody className="flex flex-col gap-5">
            {!involvement.required && (
              <Checkbox name="imOnProject" label="I'm working on this project" checked={joining} onChange={(e) => setJoining(e.target.checked)} />
            )}
            {joining && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Your capability on this project" htmlFor="myCapabilityId">
                  <Select id="myCapabilityId" name="myCapabilityId" defaultValue={involvement.defaultCapabilityId ?? ""}>
                    <option value="">Not set</option>
                    {involvement.capabilities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Your allocation %" htmlFor="myAllocation" required error={fe.myAllocation} hint="Share of your time on this project">
                  <Input id="myAllocation" name="myAllocation" type="number" min={1} max={200} step={5} defaultValue={100} aria-invalid={!!fe.myAllocation} />
                </Field>
              </div>
            )}
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Scope" description="Objectives, deliverables and boundaries of the engagement" />
        <PanelBody>
          <Field label="Project scope" htmlFor="scope" error={fe.scope}>
            <Textarea id="scope" name="scope" rows={6} defaultValue={defaults.scope ?? ""} maxLength={5000} />
          </Field>
        </PanelBody>
      </Panel>

      <div className="flex items-center justify-end gap-3">
        <Link href={cancelHref} className={buttonClass("secondary")}>
          Cancel
        </Link>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
