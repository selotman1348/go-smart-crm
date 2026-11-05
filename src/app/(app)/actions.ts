"use server";

import { redirect } from "next/navigation";

import { getAuthService, LOGIN_PATH } from "@/domain/auth";

export async function signOutAction(): Promise<void> {
  const auth = await getAuthService();
  await auth.signOut();
  redirect(LOGIN_PATH);
}
