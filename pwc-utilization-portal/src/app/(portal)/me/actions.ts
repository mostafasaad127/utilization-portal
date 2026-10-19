"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, diff } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { myPersonId } from "@/lib/access";
import { fieldErrors, type FormState } from "@/lib/validation";

const optId = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().cuid().optional());

const profileSchema = z.object({
  grade: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["ASSOCIATE", "SENIOR_ASSOCIATE", "MANAGER", "SENIOR_MANAGER", "DIRECTOR", "PARTNER"]).optional(),
  ),
  territoryId: optId,
  primaryCapabilityId: optId,
});

/** Employees maintain their own grade, territory and capability. Name and email come from SSO. */
export async function updateMyProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const personId = await myPersonId(user);
  const data = {
    grade: parsed.data.grade ?? null,
    territoryId: parsed.data.territoryId ?? null,
    primaryCapabilityId: parsed.data.primaryCapabilityId ?? null,
  };
  const before = await db.person.findUniqueOrThrow({ where: { id: personId } });
  const changes = diff(before as unknown as Record<string, unknown>, data);
  if (Object.keys(changes).length === 0) return { ok: true, message: "No changes to save." };
  await db.$transaction(async (tx) => {
    await tx.person.update({ where: { id: personId }, data });
    await audit(tx, user, { action: "person.self_update", entityType: "person", entityId: personId, summary: "Updated own profile", changes: changes as never });
  });
  revalidatePath("/me");
  return { ok: true, message: "Profile saved." };
}
