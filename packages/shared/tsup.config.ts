import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // Turbo builds dependencies before starting their consumers, so a complete
  // declaration bundle already exists when dev begins. Keep it untouched in
  // watch mode: tsup's slower DTS rebuild temporarily removes index.d.ts while
  // the API watcher is compiling and causes intermittent TS7016 errors.
  dts: !options.watch,
  clean: !options.watch,
  sourcemap: true,
  target: "es2022",
}));
