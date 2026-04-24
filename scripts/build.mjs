import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const isTty = Boolean(process.stdout.isTTY);
const useColor = isTty && !process.env.NO_COLOR;

const color = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
};

function tone(value, ...styles) {
  if (!useColor) return value;
  return `${styles.join('')}${value}${color.reset}`;
}

function printSection(icon, title, detail) {
  console.log(`\n${tone(`${icon} ${title}`, color.bold, color.cyan)}`);
  if (detail) {
    console.log(tone(detail, color.dim));
  }
}

function printResult(icon, message, toneColor) {
  console.log(tone(`${icon} ${message}`, color.bold, toneColor));
}

function runStep({ title, detail, command, args, successLabel }) {
  printSection('▶', title, detail);

  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.status === 0) {
    printResult('✓', successLabel, color.green);
    return;
  }

  printResult('✗', `${title} failed`, color.red);
  process.exit(result.status ?? 1);
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const version = pkg.version ?? 'unknown';

console.log(tone(`=== Version Hook (${version}) ===`, color.bold, color.blue));

runStep({
  title: 'Build',
  detail: 'Running production build to refresh generated assets and licenses',
  command: 'npm',
  args: ['run', 'build'],
  successLabel: 'Build completed',
});

runStep({
  title: 'Stage License Files',
  detail: 'Adding refreshed third-party license files to the version commit',
  command: 'git',
  args: ['add', 'THIRD_PARTY_LICENSE.txt', 'public/THIRD_PARTY_LICENSE.txt'],
  successLabel: 'License files staged',
});

console.log(`\n${tone('🏷 Version hook completed', color.bold, color.green)}`);
