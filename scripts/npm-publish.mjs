#!/usr/bin/env node
// First publish to npm by hand (Trusted Publishing can only be configured for packages that already exist):
//   npm login                      (account with 2FA, member of the @ecomcx org)
//   node scripts/release.mjs       (builds dist-release/ + npm-publish.json)
//   OTP=123456 node scripts/npm-publish.mjs [--content ../content]   (2FA code from your authenticator; it lives ~30s,
//                                   so all packages go in one run; --content also publishes @ecomcx/nexus-content first)
// Then on npmjs.com, for each package: Settings > Trusted Publisher > GitHub Actions,
// repository Ecomcx-Jsc/ecx-nexus-sdk, workflow publish.yml. Later versions are published by CI on each release.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "dist-release");
const list = JSON.parse(readFileSync(path.join(out, "npm-publish.json"), "utf8"));
const sh = process.platform === "win32";
const otp = process.env.OTP ? [`--otp=${process.env.OTP}`] : [];
const npm = (args, opts = {}) => execFileSync("npm", [...args, ...otp], { stdio: "inherit", shell: sh, ...opts });
const contentDir = process.argv.includes("--content") ? path.resolve(process.argv[process.argv.indexOf("--content") + 1]) : null;
if (contentDir) {
  console.log("==> @ecomcx/nexus-content");
  npm(["publish", "--access", "public", "--provenance=false"], { cwd: contentDir });
}

try { execFileSync("npm", ["view", "@ecomcx/nexus-content", "version"], { stdio: "pipe", shell: sh }); }
catch { console.error("Publish @ecomcx/nexus-content first (content repo: npm publish --provenance=false)."); process.exit(1); }

// admin-sdk before theme-sdk / the CLI (the CLI depends on admin-sdk)
const order = ["@ecomcx/nexus-admin-sdk", "@ecomcx/nexus-theme-sdk", "@ecomcx/create-nexus"];
for (const name of order) {
  const item = list.find((x) => x.name === name);
  if (!item) continue;
  console.log(`\n==> ${name} (${item.file})`);
  // Provenance only works in CI; local publish turns it off
  npm(["publish", path.join(out, item.file), "--access", "public", "--provenance=false"]);
}
console.log("\nDone. Now set up Trusted Publisher for each package on npmjs.com (see the top of this file).");
