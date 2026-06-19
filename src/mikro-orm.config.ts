import { defineConfig, EntitySchema } from '@mikro-orm/mariadb'
import { Migrator } from '@mikro-orm/migrations'
import { join } from 'node:path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

import checkConfig from './util/checkConfig.ts'
import { importPackage } from './util/package.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const entities: EntitySchema[] = []

async function getORMConfig() {
  const lotusConfig = checkConfig()

  await Promise.all(
    lotusConfig.packages.map(async (packagePath) => {
      const { entities: pkgentities } = await importPackage(packagePath)
      if (pkgentities) entities.push(...pkgentities)
    })
  )

  return defineConfig({
    ...lotusConfig.ormConfig,
    migrations: { path: join(__dirname, 'migrations'), safe: true },
    extensions: [Migrator],
    entities
  })
}

export default getORMConfig
