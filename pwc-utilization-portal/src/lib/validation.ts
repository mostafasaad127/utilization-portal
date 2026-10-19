import { z } from "zod";

export type FormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
  .transform((s) => new Date(`${s}T00:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Use a valid date");

const optionalDate = z.preprocess((v) => (v === "" || v === null ? undefined : v), dateString.optional());
const optionalId = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().cuid().optional());
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v), z.string().max(max).optional());

export const projectSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a project name").max(200),
    clientId: optionalId,
    newClientName: optionalText(200),
    industryId: optionalId,
    lineOfServiceId: optionalId,
    territoryId: z.string().cuid("Choose a territory"),
    status: z.enum(["PIPELINE", "ACTIVE", "ON_HOLD", "CLOSED"]),
    rag: z.enum(["GREEN", "AMBER", "RED"]),
    startDate: dateString,
    endDate: optionalDate,
    multiTower: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    engagementLeads: z.preprocess(
      (v) =>
        typeof v === "string"
          ? v
              .split(/[,;\n]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      z.array(z.string().max(120)).max(10),
    ),
    scope: optionalText(5000),
  })
  .superRefine((v, ctx) => {
    if (!v.clientId && !v.newClientName) ctx.addIssue({ code: "custom", path: ["clientId"], message: "Choose a client or add a new one" });
    if (v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date" });
    if (v.status === "CLOSED" && !v.endDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "A closed project needs an end date" });
  });

export const assignmentSchema = z
  .object({
    personId: z.string().cuid("Choose a person"),
    capabilityId: optionalId,
    allocation: z.coerce.number().int("Whole numbers only").min(1, "At least 1%").max(200, "At most 200%"),
    startDate: dateString,
    endDate: optionalDate,
    note: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date" });
  });

/** "Your involvement" section of the new-project form. */
export const involvementSchema = z.object({
  myAllocation: z.coerce.number().int("Whole numbers only").min(1, "At least 1%").max(200, "At most 200%"),
  myCapabilityId: optionalId,
});

export const riskSchema = z.object({
  title: z.string().trim().min(3, "Describe the risk").max(500),
  mitigation: optionalText(2000),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.enum(["OPEN", "MITIGATING", "CLOSED"]).default("OPEN"),
  owner: optionalText(120),
});

export const updateSchema = z.object({
  rag: z.enum(["GREEN", "AMBER", "RED"]),
  body: z.string().trim().min(3, "Write a short update").max(4000),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
