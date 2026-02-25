import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/cli.tsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/icloud-monitor.mjs",
  external: ["yoga-wasm-web"],
  alias: {
    "react-devtools-core": "./src/stubs/react-devtools-core.ts",
  },
  banner: {
    js: [
      "import { createRequire } from 'node:module';",
      "const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
});

console.log("Bundled → dist/icloud-monitor.mjs");
