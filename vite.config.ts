import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { defineConfig, type ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  createViteLicensePlugin,
  type LicenseMeta,
} from 'rollup-license-plugin'
import pkg from './package.json'

const thirdPartyLicenseFilename = 'THIRD_PARTY_LICENSE.txt'

function formatAuthor(author: LicenseMeta['author']): string | null {
  if (!author) {
    return null
  }

  if (typeof author === 'string') {
    return author
  }

  return author.name
}

function formatThirdPartyLicense(packages: LicenseMeta[]): string {
  const lines = [
    `${pkg.name} ${pkg.version}`,
    `Copyright ${new Date().getFullYear()} ${pkg.author}`,
    '',
    'Third-party software licenses included in this build.',
  ]

  for (const dependency of [...packages].sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(
      '',
      '-------------------------------------------------------------------------------',
      `${dependency.name} v${dependency.version}`,
      `License: ${dependency.license}`,
    )

    const author = formatAuthor(dependency.author)
    if (author) {
      lines.push(`Author: ${author}`)
    }

    if (dependency.repository) {
      lines.push(`Repository: ${dependency.repository}`)
    }

    if (dependency.source) {
      lines.push(`Source: ${dependency.source}`)
    }

    if (dependency.licenseText) {
      lines.push('', dependency.licenseText.trim())
    }
  }

  lines.push('', '-------------------------------------------------------------------------------', '')

  return lines.join('\n')
}

function syncThirdPartyLicenseFiles() {
  let config: ResolvedConfig

  return {
    name: 'sync-third-party-license-files',
    apply: 'build' as const,
    configResolved(resolvedConfig: ResolvedConfig) {
      config = resolvedConfig
    },
    async closeBundle() {
      const distFile = resolve(config.root, config.build.outDir, thirdPartyLicenseFilename)
      const destinations = [
        resolve(config.root, thirdPartyLicenseFilename),
        resolve(config.root, 'public', thirdPartyLicenseFilename),
      ]
      const contents = await readFile(distFile, 'utf8')

      await Promise.all(
        destinations.map(async (filePath) => {
          await mkdir(dirname(filePath), { recursive: true })
          await writeFile(filePath, contents)
        }),
      )
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
      additionalFiles: {
        [thirdPartyLicenseFilename]: (packages) => formatThirdPartyLicense(packages),
      },
    }),
    syncThirdPartyLicenseFiles(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
