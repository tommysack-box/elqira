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
  yellow: '\x1b[33m',
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

console.log(tone('=== Quality Check ===', color.bold, color.blue));

runStep({
  title: 'Lint',
  detail: 'Running ESLint on the project',
  command: 'npm',
  args: ['run', 'lint'],
  successLabel: 'Lint completed',
});

runStep({
  title: 'Audit',
  detail: 'Checking dependencies for known vulnerabilities',
  command: 'npm',
  args: ['audit'],
  successLabel: 'Security audit completed',
});

console.log(`\n${tone('🚀 Quality check passed', color.bold, color.green)}`);
