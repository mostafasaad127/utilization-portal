"use client";

import { Button } from "@/components/ui/button";
import { Field, FormAlert, Select } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { GRADE_LABEL, GRADES } from "@/lib/labels";
import { updateMyProfile } from "./actions";

type Option = { id: string; name: string };

export function ProfileForm({
  defaults,
  territories,
  capabilities,
}: {
  defaults: { grade: string | null; territoryId: string | null; primaryCapabilityId: string | null };
  territories: Option[];
  capabilities: Option[];
}) {
  const { state, pending, formRef, onSubmit } = useFormAction(updateMyProfile);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-5 md:grid-cols-3" noValidate>
      {state.error && (
        <div className="md:col-span-3">
          <FormAlert tone="error">{state.error}</FormAlert>
        </div>
      )}
      {state.ok && state.message && (
        <div className="md:col-span-3">
          <FormAlert tone="success">{state.message}</FormAlert>
        </div>
      )}
      <Field label="Primary capability" htmlFor="primaryCapabilityId" hint="Pre-fills when you log or join a project">
        <Select id="primaryCapabilityId" name="primaryCapabilityId" defaultValue={defaults.primaryCapabilityId ?? ""}>
          <option value="">Not set</option>
          {capabilities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Grade" htmlFor="grade">
        <Select id="grade" name="grade" defaultValue={defaults.grade ?? ""}>
          <option value="">Not set</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {GRADE_LABEL[g]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Territory" htmlFor="territoryId">
        <Select id="territoryId" name="territoryId" defaultValue={defaults.territoryId ?? ""}>
          <option value="">Not set</option>
          {territories.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end md:col-span-3">
        <Button type="submit" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
