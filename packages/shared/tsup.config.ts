import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  // Never wipe dist in watch mode. `turbo dev` runs this alongside the API's
  // tsc --watch; cleaning deletes index.d.ts out from under it, and the JS
  // re-emits faster than the declarations do — so the API typechecks against a
  // dist that has index.cjs but no types yet and reports TS7016 on every import.
  clean: !options.watch,
  sourcemap: true,
  target: "es2022",
}));
