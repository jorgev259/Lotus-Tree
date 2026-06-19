import { defineEntity, EntitySchema, p } from '@mikro-orm/core'

export const ConfigSchema = defineEntity({
  name: 'configs',
  properties: {
    guild: p.string().primary(),
    item: p.string().primary(),
    value: p.string()
  }
})

export const ModuleSchema = defineEntity({
  name: 'modules',
  properties: {
    guild: p.string().primary(),
    module: p.string().primary(),
    value: p.boolean().default(true)
  }
})

export const CommandSchema = defineEntity({
  name: 'commands',
  properties: {
    guild: p.string().primary(),
    command: p.string().primary(),
    value: p.boolean().default(true)
  }
})

export const PermSchema = defineEntity({
  name: 'perms',
  properties: {
    id: p.integer().primary().autoincrement(),
    guild: p.string(),
    command: p.string(),
    category: p.string(),
    type: p.string(),
    name: p.string(),
    createdAt: p.datetime().onCreate(() => new Date())
  }
})

const entities: EntitySchema[] = [
  ConfigSchema,
  ModuleSchema,
  CommandSchema,
  PermSchema
]

export default entities
