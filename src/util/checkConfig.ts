import { join } from 'node:path'
import fs from 'fs-extra'

import { LotusConfigCheck } from '../index.ts'

import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default function checkConfig() {
  const configPath = join(__dirname, '..', 'config', 'lotus.json')
  const examplePath = join(__dirname, '..', 'config', 'lotus.example.json')
  if (!fs.pathExistsSync(configPath)) {
    fs.copySync(examplePath, configPath)
    throw new Error(
      'Created lotus.json from lotus.example.json — configure it and restart.'
    )
  }
  const lotusConfigJson = fs.readJSONSync(configPath)
  const lotusConfig = LotusConfigCheck.check(lotusConfigJson)

  return lotusConfig
}
