#!/usr/bin/env node
/**
 * Package the web build for the Fire TV APK.
 *
 * The Android app ships the real client bundle and serves it from a local HTTP
 * server, so it needs two things this repo's normal build does not produce on
 * its own:
 *
 *   1. every static asset (`.vercel/output/static`), and
 *   2. an `index.html` app shell — the hosted build renders HTML on the server,
 *      so the shell is captured once from the preview server and frozen into
 *      the APK. Deep links are handled by the app server, which serves the same
 *      shell for every client route.
 *
 * Usage: node scripts/build-web-assets.mjs [--skip-build]
 */
import { spawn } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = join(root, ".vercel", "output", "static");
const outDir = join(root, "android", "app", "src", "main", "assets", "web");
const PREVIEW_URL = "http://127.0.0.1:8081/";

/** Older Fire OS web views need the bundle down-levelled a little. */
const BROWSER_TARGET = process.env.VOX_BUILD_TARGET || "chrome87";

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        ...extraEnv,
        PATH: `${join(root, "node_modules", ".bin")}:${process.env.PATH ?? ""}`,
      },
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

async function waitForServer(url, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      lastError = `status ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`preview server never came up (${lastError})`);
}

async function captureShell() {
  const preview = spawn("node", ["scripts/with-app-env.mjs", "vite", "preview"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PATH: `${join(root, "node_modules", ".bin")}:${process.env.PATH ?? ""}`,
    },
  });
  preview.stdout?.on("data", () => {});
  preview.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  try {
    const html = await waitForServer(PREVIEW_URL);
    if (!html.includes("<div id=") && !html.includes("<body")) {
      throw new Error("preview server returned something that is not the app shell");
    }
    return html;
  } finally {
    preview.kill("SIGTERM");
  }
}

async function main() {
  const skipBuild = process.argv.includes("--skip-build");
  if (!skipBuild) {
    console.log(`[apk] building web bundle (target ${BROWSER_TARGET})`);
    await run("node", ["scripts/with-app-env.mjs", "vite", "build"], {
      VOX_BUILD_TARGET: BROWSER_TARGET,
    });
  }
  if (!existsSync(staticDir)) {
    throw new Error(`missing ${staticDir} — run the build first`);
  }

  console.log("[apk] capturing app shell from the preview server");
  const shell = await captureShell();

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(staticDir, outDir, { recursive: true });
  await writeFile(join(outDir, "index.html"), shell, "utf8");
  console.log(`[apk] web assets ready in ${outDir}`);
}

main().catch((err) => {
  console.error(`[apk] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
