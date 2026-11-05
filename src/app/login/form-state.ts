export type LoginFormState = {
  fieldErrors?: { email?: string[]; password?: string[] };
  formError?: string;
  /** Entered e-mail address, kept so the user does not have to retype it. */
  email?: string;
};

export const initialLoginFormState: LoginFormState = {};
