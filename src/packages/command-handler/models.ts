/*
    sequelize.define('config', {
      guild: { type: STRING, unique: 'index' },
      item: { type: STRING, unique: 'index' },
      value: { type: STRING }
    })

    sequelize.define('module', {
      guild: { type: STRING, unique: 'index' },
      module: { type: STRING, unique: 'index' },
      value: { type: BOOLEAN, defaultValue: true }
    })

    sequelize.define('command', {
      guild: { type: STRING, unique: 'index' },
      command: { type: STRING, unique: 'index' },
      value: { type: BOOLEAN, defaultValue: true }
    })

    sequelize.define('perm', {
      guild: STRING,
      command: STRING,
      category: STRING,
      type: STRING,
      name: STRING
    })
*/

import { defineEntity, EntitySchema, p } from '@mikro-orm/core'

export const ConfigSchema = defineEntity({
  name: 'config',
  properties: {
    guild: p.string().primary(),
    item: p.string().primary(),
    value: p.string()
  }
})

export const ModuleSchema = defineEntity({
  name: 'module',
  properties: {
    guild: p.string().primary(),
    module: p.string().primary(),
    value: p.boolean().default(true)
  }
})

export const CommandSchema = defineEntity({
  name: 'command',
  properties: {
    guild: p.string().primary(),
    command: p.string().primary(),
    value: p.boolean().default(true)
  }
})

export const PermSchema = defineEntity({
  name: 'perm',
  properties: {
    guild: p.string(),
    command: p.string(),
    category: p.string(),
    type: p.string(),
    name: p.string(),
    createdAt: p.datetime().onCreate(() => new Date())
  }
})

const models: EntitySchema[] = [
  ConfigSchema,
  ModuleSchema,
  CommandSchema,
  PermSchema
]

export default models
