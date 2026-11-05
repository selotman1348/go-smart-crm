"use server";

import { redirect } from "next/navigation";

import { getAuthService, safeRedirectPath } from "@/domain/auth";

import type { LoginFormState } from "./form-state";

export async function signInAction(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get("email");
  const auth = await getAuthService();
  const result = await auth.signIn({
    email,
    password: formData.get("password"),
  });

  if (!result.ok) {
    return {
      fieldErrors: result.fieldErrors,
      formError: result.formError,
      email: typeof email === "string" ? email : undefined,
    };
  }

  redirect(safeRedirectPath(formData.get("next")));
}
