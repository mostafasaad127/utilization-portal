// Bundles the installer into one self-contained script to paste into the browser console.
// The Power Apps code (app/out, made by `node app/generate.ts`) is gzipped into the bundle
// and unpacked in the browser, so the script stays small enough to paste.
import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";

if (!existsSync("app/out/all-screens.pa.yaml")) {
  console.error("app/out is missing: run `node app/generate.ts` first (or `npm run build`).");
  process.exit(1);
}
const SCREEN_ORDER = ["scrHome", "scrProjects", "scrProject", "scrLog", "scrJoin", "scrProfile", "scrTeam"];
const files = {
  formulas: readFileSync("app/out/App.Formulas.txt", "utf8"),
  onStart: readFileSync("app/out/App.OnStart.txt", "utf8"),
  allScreens: readFileSync("app/out/all-screens.pa.yaml", "utf8"),
  screens: SCREEN_ORDER.filter((s) => readdirSync("app/out").includes(`${s}.pa.yaml`)).map((s) => ({ name: s, yaml: readFileSync(`app/out/${s}.pa.yaml`, "utf8") })),
};
// "All screens" is rebuilt in the browser from the per-screen files (see app-steps.ts); prove it's identical.
const joined = "Screens:\n" + files.screens.map((s) => s.yaml.replace(/^Screens:\n/, "")).join("");
if (joined !== files.allScreens) throw new Error("all-screens.pa.yaml is not the concatenation of the screen files");
delete files.allScreens;
const packed = gzipSync(Buffer.from(JSON.stringify(files)), { level: 9 }).toString("base64");

mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["src/install.ts"],
  bundle: true,
  format: "iife",
  target: ["chrome100", "edge100"],
  outfile: "dist/install.js",
  legalComments: "none",
  minify: true,
  define: { __APP_PACK__: JSON.stringify(packed) },
  banner: { js: "/* Utilization Portal — SharePoint installer. Paste into the browser console (F12) on your SharePoint site and press Enter. */" },
});
const size = readFileSync("dist/install.js").length;
console.log(`dist/install.js  ${(size / 1024).toFixed(1)} KB  (app code: ${(JSON.stringify(files).length / 1024).toFixed(0)} KB → ${(packed.length / 1024).toFixed(0)} KB packed)`);
