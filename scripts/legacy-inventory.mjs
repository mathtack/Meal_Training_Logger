import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, isAbsolute, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, build } from "vite";

// Offline only: no Supabase client, credentials, browser session, or network calls.
const [command, ...args] = process.argv.slice(2);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outsideRepository = path => {
  const absolute = resolve(path);
  const rel = relative(root, absolute);
  if (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) throw new Error("Output must be outside the repository.");
  return absolute;
};
if (command === "browser-bundle" && args.length === 1) {
  const file = outsideRepository(args[0]);
  await build({ root, configFile: false, publicDir: false, build: { write: true, emptyOutDir: false,
    outDir: dirname(file), lib: { entry: resolve(root, "src/legacy/localStorage/legacyInventory.ts"), name: "LegacyInventory", formats: ["iife"], fileName: () => file.slice(dirname(file).length + 1) },
  } });
} else if (command === "compare" && args.length === 4) {
  const [captureFile, cloudFile, reportFile, reference] = args;
  const output = outsideRepository(reportFile);
  const capture = JSON.parse(await readFile(captureFile, "utf8"));
  const cloud = JSON.parse(await readFile(cloudFile, "utf8"));
  const server = await createServer({ root, configFile: false, server: { middlewareMode: true }, appType: "custom" });
  try {
    const { compareLegacyInventory } = await server.ssrLoadModule("/src/legacy/localStorage/legacyInventory.ts");
    const report = await compareLegacyInventory(capture, cloud);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify({ ...report, sourceExportReference: reference }, null, 2), { flag: "wx" });
    console.log(JSON.stringify({ counts: report.counts, unresolved: report.unresolved }));
  } finally { await server.close(); }
} else {
  console.error("Usage: node scripts/legacy-inventory.mjs browser-bundle <outside-repo.js>\n       node scripts/legacy-inventory.mjs compare <capture.json> <cloud.json> <outside-repo-report.json> <private-export-reference>");
  process.exitCode = 1;
}
