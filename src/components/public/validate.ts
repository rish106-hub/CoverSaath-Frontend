import { accessInputSchema } from "@/adapters/schemas";

export type AccessErrors = { name?: string; email?: string };

/** Client-side check for the access form. Uses the same zod schema as the adapter. */
export function validateAccess(name: string, email: string): { ok: true } | { ok: false; errors: AccessErrors } {
  const r = accessInputSchema.safeParse({ name, email });
  if (r.success) return { ok: true };
  const errors: AccessErrors = {};
  for (const issue of r.error.issues) {
    const key = issue.path[0];
    if (key === "name" && !errors.name) errors.name = "Tell us your name.";
    if (key === "email" && !errors.email) errors.email = "Enter an email like name@company.com.";
  }
  return { ok: false, errors };
}
