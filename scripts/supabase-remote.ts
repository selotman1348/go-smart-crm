/**
 * Runs a Supabase CLI command against the hosted project in .env.local.
 *
 *   npm run db:push        -> supabase db push --remote=<ref> --yes
 *   npm run db:types       -> supabase gen types --remote=<ref> ... > database.types.ts
 *
 * The project ref comes from NEXT_PUBLIC_SUPABASE_URL; the CLI authenticates
 * with SUPABASE_ACCESS_TOKEN. Neither value is printed.
 *
 * Usage: tsx scripts/supabase-remote.ts [--out <file>] <cli args...>
 */
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const projectRef = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url)?.[1];
if (!projectRef) {
  fail("NEXT_PUBLIC_SUPABASE_URL must be the hosted project URL (https://<ref>.supabase.co).");
}
if (!process.env.SUPABASE_ACCESS_TOKEN) {
  fail("SUPABASE_ACCESS_TOKEN is not set. Add it to .env.local (see .env.example).");
}

const args = process.argv.slice(2);
let outFile: string | undefined;
const outIndex = args.indexOf("--out");
if (outIndex !== -1) {
  outFile = args[outIndex + 1];
  args.splice(outIndex, 2);
}

// Run the pinned CLI (dev dependency) directly, without a shell.
const cli = createRequire(import.meta.url).resolve("supabase/dist/supabase.js");
const child = spawn(process.execPath, [cli, ...args, `--remote=${projectRef}`], {
  stdio: ["inherit", outFile ? "pipe" : "inherit", "inherit"],
  env: process.env,
});

let stdout = "";
child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
  stdout += chunk;
});

child.on("close", async (code) => {
  if (code === 0 && outFile) {
    await writeFile(outFile, stdout);
    console.log(`wrote ${outFile}`);
  }
  process.exit(code ?? 1);
});
