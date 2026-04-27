import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
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

printStep('license', 'Copying LICENSE into dist/');
await copyFile(path.join(rootDir, 'LICENSE'), path.join(rootDir, 'dist', 'LICENSE'));

printStep(
  'changelog',
  args.includes('--prepend')
    ? `Prepending unreleased changes into CHANGELOG.md as ${versionTag}`
    : 'Regenerating CHANGELOG.md from git history'
);

run(gitCliffBin, args, 'Running git-cliff', { step: 'changelog' });
run(
  'git',
  [
    'add',
    'THIRD_PARTY_LICENSE.txt',
    'CHANGELOG.md',
  ],
  'Staging release files for the npm version commit',
  { step: 'stage' }
);
printStep('done', `Release files are ready for ${versionTag}`);
