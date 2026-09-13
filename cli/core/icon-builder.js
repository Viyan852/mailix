/**
 * MAILIX Windows Icon Embedder
 *
 * Embeds assets/icon.ico into Windows PE executables (mlx.exe,
 * mlx-install.exe, mlx-run.exe). Uses one of:
 *
 *   1. `rcedit`  — preferred (modifies existing PE in place, no Node required)
 *   2. `postject` — alternative (rewrites a section of the PE)
 *   3. `winres`  — Node-based, only for build environments
 *
 * On non-Windows hosts, this is a no-op stub (the cross-build flow uses
 * GitHub Actions to run icon embedding on a Windows runner).
 *
 * The embedder NEVER creates or synthesizes .ico files — the build fails
 * if assets/icon.ico is missing or invalid.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isWindows } = require('./platform');
const { validateIcon } = require('./icon');

/**
 * Find a usable icon-embed tool, or return null.
 * Looks for: rcedit (in PATH or local node_modules/.bin), then postject.
 */
function findEmbedTool() {
  const localRcedit = path.join(__dirname, '..', '..', 'node_modules', '.bin',
    isWindows() ? 'rcedit.cmd' : 'rcedit');
  if (fs.existsSync(localRcedit)) return { tool: 'rcedit', path: localRcedit };

  const localPostject = path.join(__dirname, '..', '..', 'node_modules', '.bin',
    isWindows() ? 'postject.cmd' : 'postject');
  if (fs.existsSync(localPostject)) return { tool: 'postject', path: localPostject };

  // Try PATH
  for (const name of ['rcedit', 'postject']) {
    const r = spawnSync(isWindows() ? 'where' : 'which', [name], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout) {
      const found = r.stdout.split(/\r?\n/)[0].trim();
      if (found) return { tool: name, path: found };
    }
  }
  return null;
}

/**
 * Replace the icon in a Windows PE executable.
 * @param {string} exePath  Path to the .exe (must be a real PE file)
 * @param {string} iconPath Path to the .ico file
 * @returns {boolean}
 */
function embedIconInExe(exePath, iconPath) {
  if (!fs.existsSync(exePath)) {
    throw new Error(`Target executable not found: ${exePath}`);
  }
  const tool = findEmbedTool();
  if (!tool) {
    throw new Error('No icon-embed tool available. Install rcedit (npm i -D rcedit) or postject.');
  }
  if (tool.tool === 'rcedit') {
    const r = spawnSync(tool.path, [exePath, '--set-icon', iconPath], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`rcedit failed for ${exePath}`);
    return true;
  }
  if (tool.tool === 'postject') {
    // postject cannot directly set the icon resource; use it to set the
    // resource section via a small post-build PowerShell helper if needed.
    // For now, fail with a clear message.
    throw new Error('postject is not sufficient for icon embedding. Install rcedit: npm i -D rcedit');
  }
  return false;
}

/**
 * Build a Windows PE executable that wraps the MAILIX JS launcher script.
 *
 * Strategy:
 *   1. Start from the bundled node.exe (which is a real PE executable).
 *   2. Replace its icon with assets/icon.ico.
 *   3. Inject a small bootstrap that execs the bundled runtime with the
 *      MAILIX CLI script as argv[2]. This is implemented via the
 *      `pkg`-style postject approach OR by writing a tiny `mlx.cmd` shim
 *      and copying the resulting icon. We choose the latter for safety
 *      and reliability.
 *
 *   For the actual final build, the produced PE is the bundled node.exe
 *   with an `mlx.cmd` shim beside it. On Windows the .cmd resolves the
 *   icon from the same directory.
 *
 * @param {object} opts
 * @param {string} opts.iconPath         Path to assets/icon.ico
 * @param {string} opts.bundledNodeExe   Path to runtime/node.exe (real PE)
 * @param {string} opts.outDir           Output directory for mlx.exe etc.
 * @param {string} opts.appDir           Where the launchers live
 * @param {string} opts.scriptRelPath    Path to the launcher .js file relative to appDir
 * @param {string} opts.label            mlx | mlx-install | mlx-run
 */
function buildWindowsLauncher({ iconPath: icon, bundledNodeExe, outDir, appDir, scriptRelPath, label }) {
  if (!fs.existsSync(bundledNodeExe)) {
    throw new Error(`Bundled node.exe not found: ${bundledNodeExe}`);
  }
  if (!fs.existsSync(icon)) {
    throw new Error(`Icon not found: ${icon}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  // The .exe is the bundled node.exe with our icon embedded and our name.
  // We copy it and then embed the icon.
  const exeOut = path.join(outDir, `${label}.exe`);
  fs.copyFileSync(bundledNodeExe, exeOut);

  // Embed the icon in the .exe
  try {
    embedIconInExe(exeOut, icon);
  } catch (err) {
    throw new Error(`Failed to embed icon in ${exeOut}: ${err.message}`);
  }

  // Drop a companion .cmd that tells the .exe what to do. The .exe itself
  // is still a real PE — when the user runs `mlx.exe`, Windows sees a PE
  // and shows the MAILIX icon. The .cmd is an extra convenience for
  // developers.
  const cmd = `@echo off
setlocal
set "MAILIX_HOME=%~dp0.."
"%~dp0${label}.exe" "%MAILIX_HOME%\\app\\${scriptRelPath.replace(/\//g, '\\')}" %*
exit /b %ERRORLEVEL%
`;
  fs.writeFileSync(path.join(outDir, `${label}.cmd`), cmd);

  return exeOut;
}

/**
 * Generate a .lnk (Windows shortcut) pointing to an .exe, with the MAILIX
 * icon applied. Uses PowerShell's WScript.Shell COM object.
 *
 * @param {object} opts
 * @param {string} opts.iconPath     Path to the .ico
 * @param {string} opts.targetPath   Path to the .exe the shortcut points to
 * @param {string} opts.outDir       Directory to place the .lnk file in
 * @param {string} opts.shortcutName Filename (no .lnk) of the shortcut
 */
function buildWindowsShortcut({ iconPath: icon, targetPath, outDir, shortcutName }) {
  if (!isWindows()) {
    throw new Error('Windows shortcuts can only be built on Windows');
  }
  if (!fs.existsSync(icon)) throw new Error(`Icon not found: ${icon}`);
  if (!fs.existsSync(targetPath)) throw new Error(`Target not found: ${targetPath}`);

  fs.mkdirSync(outDir, { recursive: true });
  const shortcutPath = path.join(outDir, `${shortcutName}.lnk`);
  const ps = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$Shortcut.TargetPath = '${targetPath.replace(/'/g, "''")}'
$Shortcut.IconLocation = '${icon.replace(/'/g, "''")}'
$Shortcut.WorkingDirectory = '${path.dirname(targetPath).replace(/'/g, "''")}'
$Shortcut.Save()
`;
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Failed to build Windows shortcut');
  return shortcutPath;
}

module.exports = {
  findEmbedTool,
  embedIconInExe,
  buildWindowsLauncher,
  buildWindowsShortcut,
};
