/**
 * Pin the pruned dist/package.json to the versions the workspace actually installed.
 *
 * The backend image runs `pnpm install --prod` against dist/package.json (see
 * apps/backend/Dockerfile). That install has no lockfile to go on:
 * @nx/js:prune-lockfile emits a pnpm-lock.yaml that is a copy of the whole
 * workspace graph rather than a pruned one, so its importers do not match the
 * single-package dist/package.json. We delete it below.
 *
 * So every dependency's caret range is re-resolved against the registry at image
 * build time, and two builds of the same commit can produce different images.
 * That is not hypothetical: `better-auth` was declared `^1.6.22`, the workspace
 * resolved 1.6.22, and a later clean build picked up 1.7.5, which dropped the
 * `verifyAccessToken` export that mcp-bearer.guard.ts imports -- so the bundle
 * threw at module load and the machine never came up. (That one is now pinned
 * to 1.6.22 in the manifests, but every other caret range is still live.) The
 * root `overrides` block is dropped by pruning too, which is why the image
 * installed ai@6 while the workspace runs ai@7.
 *
 * Rewriting each range to the exact installed version makes the image match what
 * was built, linted and tested. Workspace packages are left alone: prune-lockfile
 * already rewrites their `workspace:*` ranges to `file:` paths.
 *
 * This also deletes the lockfile prune-lockfile leaves behind, so the image does
 * not install against a manifest and lockfile that disagree.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const distPackageJson = resolve(import.meta.dirname, '../dist/package.json');
const distLockfile = resolve(import.meta.dirname, '../dist/pnpm-lock.yaml');
const appDir = resolve(import.meta.dirname, '..');
const workspaceRoot = resolve(import.meta.dirname, '../../..');

/**
 * Resolve a package's installed version by walking node_modules from the app
 * directory up to the workspace root. We look the directory up by hand rather
 * than using require.resolve, because packages that restrict their `exports`
 * (better-auth among them) refuse to resolve their own package.json.
 */
function installedVersion(name: string): string | null {
  let dir = appDir;
  for (;;) {
    const manifest = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(manifest)) {
      const { version } = JSON.parse(readFileSync(manifest, 'utf8'));
      if (typeof version === 'string') return version;
    }
    if (dir === workspaceRoot) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const pkg = JSON.parse(readFileSync(distPackageJson, 'utf8'));
const deps: Record<string, string> = pkg.dependencies ?? {};

const pinned: string[] = [];
const unresolved: string[] = [];

for (const [name, range] of Object.entries(deps)) {
  // Workspace packages are already pointed at workspace_modules by fix-lockfile-symlinks.
  if (range.startsWith('file:')) continue;

  const version = installedVersion(name);
  if (!version) {
    unresolved.push(name);
    continue;
  }
  if (range !== version) pinned.push(`${name}: ${range} -> ${version}`);
  deps[name] = version;
}

if (unresolved.length > 0) {
  console.error(
    `Could not resolve an installed version for: ${unresolved.join(', ')}.\n` +
      'Run `pnpm install` at the workspace root before building the image.',
  );
  process.exit(1);
}

// The image only ever runs `pnpm install --prod`, and the nx block is build
// metadata that the runtime has no use for. Dropping both keeps the manifest to
// what the image actually installs.
delete pkg.devDependencies;
delete pkg.nx;

writeFileSync(distPackageJson, `${JSON.stringify(pkg, null, 2)}\n`);
rmSync(distLockfile, { force: true });

console.log(
  `Pinned ${Object.keys(deps).length} dependencies to installed versions.`,
);
for (const change of pinned) console.log(`  ${change}`);
