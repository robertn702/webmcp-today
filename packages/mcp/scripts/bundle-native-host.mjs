import { build } from "esbuild";

await build({
  entryPoints: ["dist/native-host.js"],
  bundle: true,
  format: "esm",
  outfile: "dist/native-host.standalone.js",
  platform: "node",
  target: "node20",
});
