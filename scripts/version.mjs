import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
const thirdPartyLicensePath = path.join(rootDir, 'THIRD_PARTY_LICENSE.txt');
const distThirdPartyLicensePath = path.join(rootDir, 'dist', 'THIRD_PARTY_LICENSE.txt');
const electronPackageJsonPath = path.join(rootDir, 'node_modules', 'electron', 'package.json');
const electronLicensePath = path.join(rootDir, 'node_modules', 'electron', 'LICENSE');
const electronChromiumLicensesPath = path.join(rootDir, 'node_modules', 'electron', 'dist', 'LICENSES.chromium.html');
const rootChromiumLicensesPath = path.join(rootDir, 'LICENSES.chromium.html');
const gitCliffBin = path.join(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'git-cliff.cmd' : 'git-cliff'
);

function printStep(step, message) {
  console.log(`\n[version ${step}] ${message}`);
}

function run(command, args, description, options = {}) {
  printStep(options.step ?? 'run', description);

  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    ...options.spawnOptions,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 0) !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function updateDesktopLicenseFiles() {
  printStep('licenses', 'Extending THIRD_PARTY_LICENSE.txt with Electron runtime notices');

  const [currentThirdPartyLicense, electronPackageRaw, electronLicenseText] = await Promise.all([
    readFile(thirdPartyLicensePath, 'utf8'),
    readFile(electronPackageJsonPath, 'utf8'),
    readFile(electronLicensePath, 'utf8'),
  ]);

  const electronPackage = JSON.parse(electronPackageRaw);
  const electronSection = [
    '',
    '-------------------------------------------------------------------------------',
    `electron v${electronPackage.version}`,
    `License: ${electronPackage.license ?? 'MIT'}`,
    `Author: ${electronPackage.author ?? 'Electron Community'}`,
    `Repository: ${electronPackage.repository ?? 'https://github.com/electron/electron'}`,
    'Source: https://www.npmjs.com/package/electron',
    '',
    electronLicenseText.trim(),
    '',
    '-------------------------------------------------------------------------------',
    'Electron bundled third-party notices',
    'License: See LICENSES.chromium.html',
    'Source: node_modules/electron/dist/LICENSES.chromium.html',
    '',
    'This distribution includes the Electron runtime and Chromium-based components.',
    'Their bundled third-party notices are shipped separately in LICENSES.chromium.html.',
    '',
  ].join('\n');

  const nextThirdPartyLicense = `${currentThirdPartyLicense.trimEnd()}\n${electronSection}`;

  await Promise.all([
    writeFile(thirdPartyLicensePath, nextThirdPartyLicense),
    writeFile(distThirdPartyLicensePath, nextThirdPartyLicense),
    copyFile(electronChromiumLicensesPath, rootChromiumLicensesPath),
  ]);
}

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const versionTag = `v${packageJson.version}`;
const versionTagExists = spawnSync(
  'git',
  ['rev-parse', '-q', '--verify', `refs/tags/${versionTag}`],
  {
    cwd: rootDir,
    stdio: 'ignore',
  }
).status === 0;
const args = !existsSync(changelogPath) || versionTagExists
  ? ['-o', 'CHANGELOG.md']
  : ['--unreleased', '--tag', versionTag, '--prepend', 'CHANGELOG.md'];

printStep('init', `Preparing release assets for ${versionTag}`);
run('npm', ['run', 'build:web'], 'Building web assets', { step: 'build' });
printStep(
  'changelog',
  args.includes('--prepend')
    ? `Prepending unreleased changes into CHANGELOG.md as ${versionTag}`
    : 'Regenerating CHANGELOG.md from git history'
);

//Update THIRD_PARTY_LICENSE.txt (post build), CHANGELOG.md (git-cliff) 
await updateDesktopLicenseFiles();
run(gitCliffBin, args, 'Running git-cliff', { step: 'changelog' });
run(
  'git',
  [
    'add',
    'THIRD_PARTY_LICENSE.txt',
    'LICENSES.chromium.html',
    'CHANGELOG.md',
  ],
  'Staging release files for the npm version commit',
  { step: 'stage' }
);
printStep('done', `Release files are ready for ${versionTag}`);
