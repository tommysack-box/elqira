import { spawnSync } from 'node:child_process';
import process from 'node:process';

const rootDir = process.cwd();

function printStep(step, message) {
  console.log(`\n[preversion ${step}] ${message}`);
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

printStep('init', 'Running release quality checks before the version bump');
run('npm', ['run', 'lint'], 'Running ESLint', { step: 'lint' });
run('npm', ['audit'], 'Running npm audit', { step: 'audit' });
printStep('done', 'Pre-version checks completed successfully');
