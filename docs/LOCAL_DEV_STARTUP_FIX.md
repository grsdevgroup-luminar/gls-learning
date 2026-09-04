# Local development startup fix

Use this guide when local-only changes cannot be committed or pushed. The fix
prevents `@skillstream/shared` declaration files from disappearing while the
Nest API starts.

## Why this is needed

Two processes previously rebuilt `@skillstream/shared` during startup:

- Turbo runs `@skillstream/shared#build` before starting the API and web apps.
- The web package's `predev` script started another full shared build while the
  API was compiling.

That second build cleaned `packages/shared/dist` and temporarily removed
`index.d.ts`, causing API error `TS7016`.

## Apply the local-only fix

Run this from the repository root. It applies the patch only when the old
`predev` entry is present, so running the block again is safe.

```bash
cd ~/Glide/gls-learning

if rg -q '"predev": "pnpm --filter @skillstream/shared build"' apps/web/package.json; then
  git apply <<'PATCH'
diff --git a/apps/web/package.json b/apps/web/package.json
--- a/apps/web/package.json
+++ b/apps/web/package.json
@@ -3,7 +3,6 @@
   "version": "0.1.0",
   "private": true,
   "scripts": {
-    "predev": "pnpm --filter @skillstream/shared build",
     "dev": "next dev --webpack -p 3001",
     "build": "next build",
     "start": "next start",
diff --git a/packages/shared/tsup.config.ts b/packages/shared/tsup.config.ts
--- a/packages/shared/tsup.config.ts
+++ b/packages/shared/tsup.config.ts
@@ -3,11 +3,11 @@ import { defineConfig } from "tsup";
 export default defineConfig((options) => ({
   entry: ["src/index.ts"],
   format: ["esm", "cjs"],
-  dts: true,
-  // Never wipe dist in watch mode. `turbo dev` runs this alongside the API's
-  // tsc --watch; cleaning deletes index.d.ts out from under it, and the JS
-  // re-emits faster than the declarations do — so the API typechecks against a
-  // dist that has index.cjs but no types yet and reports TS7016 on every import.
+  // Turbo builds dependencies before starting their consumers, so a complete
+  // declaration bundle already exists when dev begins. Keep it untouched in
+  // watch mode: tsup's slower DTS rebuild temporarily removes index.d.ts while
+  // the API watcher is compiling and causes intermittent TS7016 errors.
+  dts: !options.watch,
   clean: !options.watch,
   sourcemap: true,
   target: "es2022",
PATCH
else
  echo "Local development startup fix is already applied."
fi
```

## Verify the fix

```bash
rg -n 'dts: !options.watch' packages/shared/tsup.config.ts

if rg -n '"predev"' apps/web/package.json; then
  echo "ERROR: the web predev build is still present"
else
  echo "OK: the redundant web predev build is absent"
fi

pnpm --filter @skillstream/shared build
pnpm --filter @skillstream/api typecheck
pnpm --filter @skillstream/web typecheck
```

All three commands must exit successfully. The first `rg` command should show
`dts: !options.watch`, and the predev check should print `OK`.

## Start development

Stop any existing development process with `Ctrl-C`, then run:

```bash
pnpm dev
```

The existing tmux launcher may also be used normally:

```bash
~/Glide/dev-tools/tmux/gls-learning.sh
```

The launcher attaches to an existing `gls-learning` tmux session without
restarting its processes. If that session already exists, open its `dev` window,
stop the old process with `Ctrl-C`, and run `pnpm dev` again.

## Confirm the API started

The API terminal should report a successful Nest compilation and listen on port
4000. Confirm it from another terminal with:

```bash
curl -I http://localhost:4000/docs
```

The important result is receiving an HTTP response instead of
`ECONNREFUSED 127.0.0.1:4000`.
