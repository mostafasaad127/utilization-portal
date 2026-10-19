import "server-only";
import { db } from "@/lib/db";

/**
 * Returns the resource (Person) record for a login, linking an existing record
 * with the same email or creating one. Idempotent and race-safe.
 */
export async function ensurePersonForUser(user: { id: string; name: string; email: string }): Promise<string> {
  const linked = await db.person.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (linked) return linked.id;

  const email = user.email.toLowerCase();
  const byEmail = await db.person.findUnique({ where: { email }, select: { id: true, userId: true } });
  if (byEmail && !byEmail.userId) {
    await db.person.update({ where: { id: byEmail.id }, data: { userId: user.id } });
    return byEmail.id;
  }

  try {
    const created = await db.person.create({
      // If the email is already linked to another login, keep the record unique by leaving email empty.
      data: { name: user.name, email: byEmail ? null : email, userId: user.id },
      select: { id: true },
    });
    return created.id;
  } catch (e) {
    // Another request created it concurrently.
    if ((e as { code?: string }).code === "P2002") {
      const again = await db.person.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (again) return again.id;
    }
    throw e;
  }
}
