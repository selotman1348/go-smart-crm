import { z } from "zod";

// UC-01: internal users sign in with their e-mail address and password.
const loginInputSchema = z.object({
  email: z
    .string({ error: "Enter your e-mail address." })
    .trim()
    .min(1, { error: "Enter your e-mail address." })
    .pipe(z.email({ error: "Enter a valid e-mail address." })),
  password: z
    .string({ error: "Enter your password." })
    .min(1, { error: "Enter your password." }),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export type LoginFieldErrors = Partial<Record<keyof LoginInput, string[]>>;

export type ParsedLoginInput =
  | { ok: true; value: LoginInput }
  | { ok: false; fieldErrors: LoginFieldErrors };

export function parseLoginInput(input: unknown): ParsedLoginInput {
  const result = loginInputSchema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return { ok: false, fieldErrors: z.flattenError(result.error).fieldErrors };
}
