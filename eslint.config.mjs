import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { defineConfig } from '@eslint/config-helpers'
import { FlatCompat } from '@eslint/eslintrc'

import config from 'eslint-config-standard'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname
})

export default defineConfig([...compat.config(config), eslintConfigPrettier])
