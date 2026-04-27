import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const thirdPartyLicensePath = path.join(rootDir, 'THIRD_PARTY_LICENSE.txt');
const electronPackageJsonPath = path.join(rootDir, 'node_modules', 'electron', 'package.json');
const electronLicensePath = path.join(rootDir, 'node_modules', 'electron', 'LICENSE');
const electronChromiumLicensesPath = path.join(rootDir, 'node_modules', 'electron', 'dist', 'LICENSES.chromium.html');
const rootChromiumLicensesPath = path.join(rootDir, 'LICENSES.chromium.html');

function printStep(step, message) {
  console.log(`\n[build:win ${step}] ${message}`);
}

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
  copyFile(electronChromiumLicensesPath, rootChromiumLicensesPath),
]);

printStep('done', 'Desktop license files are ready');
