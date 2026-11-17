/**
 * Wire (or unwire) this package into a DSH profile.
 *
 *   node tools/profile-link.mjs install   [--profile desktop] [--home <DSH_HOME>]
 *   node tools/profile-link.mjs uninstall [--profile desktop] [--home <DSH_HOME>]
 *   node tools/profile-link.mjs status    [--profile desktop] [--home <DSH_HOME>]
 *
 * What "install" does, all of it reversible:
 *   1. adds `"dsh-ink-landscape": "link:<this repo>"` to the profile's deps;
 *   2. appends `dsh-ink-landscape` to `dsh.profile.bundles`;
 *   3. creates the `node_modules/dsh-ink-landscape` junction.
 *
 * "uninstall" undoes exactly those three things and leaves a
 * `package.json.bak-ink-<stamp>` next to the previous file.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync, copyFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const PACKAGE = 'dsh-ink-landscape'
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
const action = argv[0] ?? 'status'
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 ? argv[index + 1] : fallback
}

const profile = flag('profile', 'desktop')
const home = flag('home', process.env.DSH_HOME ?? 'D:/Apps/dsh-data/dsh-home')
const profileDir = join(home, 'profiles', profile)
const manifestPath = join(profileDir, 'package.json')
const linkPath = join(profileDir, 'node_modules', PACKAGE)

if (!existsSync(manifestPath)) {
  console.error(`no profile manifest at ${manifestPath}`)
  process.exit(1)
}

const read = () => JSON.parse(readFileSync(manifestPath, 'utf8'))
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)

function junction(action) {
  const quoted = (path) => `'${path.replace(/'/g, "''")}'`
  // `cmd /c mklink /J` gets mangled by MSYS shells, so go through PowerShell.
  const script =
    action === 'create'
      ? `New-Item -ItemType Junction -Path ${quoted(linkPath)} -Target ${quoted(repo)} | Out-Null`
      : `if (Test-Path ${quoted(linkPath)}) { (Get-Item ${quoted(linkPath)}).Delete() }`
  execFileSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'inherit' })
}

const linked = () => existsSync(linkPath)

if (action === 'status') {
  const pkg = read()
  console.log(`profile       : ${profileDir}`)
  console.log(`dependency    : ${pkg.dependencies?.[PACKAGE] ?? '(absent)'}`)
  console.log(`bundles       : ${(pkg.dsh?.profile?.bundles ?? []).includes(PACKAGE) ? 'listed' : '(absent)'}`)
  console.log(`node_modules  : ${linked() ? 'linked' : '(absent)'}`)
} else if (action === 'uninstall') {
  const pkg = read()
  copyFileSync(manifestPath, `${manifestPath}.bak-ink-${stamp()}`)
  if (pkg.dependencies) delete pkg.dependencies[PACKAGE]
  if (Array.isArray(pkg.dsh?.profile?.bundles)) {
    pkg.dsh.profile.bundles = pkg.dsh.profile.bundles.filter((name) => name !== PACKAGE)
  }
  writeFileSync(manifestPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  if (linked()) junction('remove')
  console.log(`uninstalled ${PACKAGE} from profile ${profile}`)
} else if (action === 'install') {
  const pkg = read()
  copyFileSync(manifestPath, `${manifestPath}.bak-ink-${stamp()}`)
  pkg.dependencies = pkg.dependencies ?? {}
  pkg.dependencies[PACKAGE] = `link:${repo.replace(/\\/g, '/')}`
  pkg.dsh = pkg.dsh ?? {}
  pkg.dsh.profile = pkg.dsh.profile ?? {}
  const bundles = new Set(pkg.dsh.profile.bundles ?? [])
  bundles.add(PACKAGE)
  pkg.dsh.profile.bundles = [...bundles]
  writeFileSync(manifestPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  if (linked()) junction('remove')
  junction('create')
  console.log(`installed ${PACKAGE} into profile ${profile} — restart the app to load it`)
} else {
  console.error(`unknown action: ${action}`)
  process.exit(2)
}
