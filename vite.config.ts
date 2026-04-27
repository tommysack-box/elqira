import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  createViteLicensePlugin,
  type LicenseMeta,
} from 'rollup-license-plugin'
import pkg from './package.json'

const thirdPartyLicenseFilename = 'THIRD_PARTY_LICENSE.txt'

function formatAuthor(author: LicenseMeta['author']): string | null {
  if (!author) return null
  if (typeof author === 'string') return author
  return author.name
}

function formatThirdPartyLicense(packages: LicenseMeta[]): string {
  const lines = [
    `${pkg.name} ${pkg.version}`,
    `Copyright ${new Date().getFullYear()} ${pkg.author}`,
    '',
    'Third-party software licenses included in this build.',
  ]

  for (const dep of [...packages].sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push('', '-------------------------------------------------------------------------------', `${dep.name} v${dep.version}`, `License: ${dep.license}`)
    const author = formatAuthor(dep.author)
    if (author) lines.push(`Author: ${author}`)
    if (dep.repository) lines.push(`Repository: ${dep.repository}`)
    if (dep.source) lines.push(`Source: ${dep.source}`)
    if (dep.licenseText) lines.push('', dep.licenseText.trim())
  }

  lines.push('', '-------------------------------------------------------------------------------', '')
  return lines.join('\n')
}

function writeLicenseToRoot() {
  return {
    name: 'write-license-to-root',
    apply: 'build' as const,
    async generateBundle(_: unknown, bundle: Record<string, { name?: string; fileName?: string; source?: string | Uint8Array }>) {
      const entry = Object.values(bundle).find(
        (f) => f.fileName === thirdPartyLicenseFilename || f.name === thirdPartyLicenseFilename
      )
      if (entry && 'source' in entry && typeof entry.source === 'string') {
        await writeFile(resolve(process.cwd(), thirdPartyLicenseFilename), entry.source)
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    createViteLicensePlugin({
      outputFilename: false,
      licenseOverrides: {
        'rgbcolor@1.0.1': 'MIT',
      },
      additionalFiles: {
        [thirdPartyLicenseFilename]: (packages) => formatThirdPartyLicense(packages),
      },
    }),
    writeLicenseToRoot(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
