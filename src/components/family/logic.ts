/** Normalises an Indian mobile typed with or without +91 / spaces. Returns null when it is not 10 digits starting 6-9. */
export function normaliseIndianMobile(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "").replace(/^\+?91/, "");
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function validateAddMember(name: string, mobile: string, requireMobile = true): { name?: string; mobile?: string } {
  const errors: { name?: string; mobile?: string } = {};
  if (name.trim().length < 2) errors.name = "Enter a name.";
  if (requireMobile && !normaliseIndianMobile(mobile)) errors.mobile = "Enter a 10-digit mobile number.";
  return errors;
}

export type EditErrors = { name?: string; mobile?: string; email?: string };

/** Mobile and email are optional; when given they must be valid. */
export function validateEditMember(name: string, mobile: string, email: string): EditErrors {
  const errors: EditErrors = {};
  if (name.trim().length < 2) errors.name = "Enter a name.";
  if (mobile.trim() && !normaliseIndianMobile(mobile)) errors.mobile = "Enter a 10-digit mobile number.";
  if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email address.";
  return errors;
}
