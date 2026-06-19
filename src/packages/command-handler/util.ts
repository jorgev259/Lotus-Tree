import { PermissionsBitField, type Snowflake } from 'discord.js'

import type { ClientGlobals, GuildMessage, ReadyCommand } from '../../index.ts'
import {
  CommandSchema,
  ConfigSchema,
  ModuleSchema,
  PermSchema
} from './entities.ts'

const orderCategory = ['user', 'role', 'channel']
const orderType = ['deny', 'allow']

export async function checkGuildConfig(
  guild: Snowflake,
  globals: ClientGlobals
) {
  const { config, defaultConfig, orm, commands, modules } = globals

  if (!config[guild]) config[guild] = {}
  if (!config.global) config.global = {}

  for (const [item, value] of Object.entries(defaultConfig.global!)) {
    const row = await orm.upsert(ConfigSchema, { guild: 'global', item, value })
    config.global[item] = row.value
  }

  for (const [item, value] of Object.entries(defaultConfig.guild!)) {
    const row = await orm.upsert(ConfigSchema, { guild, item, value })
    config[guild][item] = row.value
  }

  for (const module of modules.values()) {
    const { value } = await orm.upsert(ModuleSchema, {
      guild,
      module: module.name
    })
    module.enabled[guild] = value
  }

  for (const command of commands.values()) {
    const { value } = await orm.upsert(CommandSchema, {
      guild,
      command: command.name
    })
    command.enabled[guild] = value
  }
}

export async function permCheck(
  command: ReadyCommand,
  message: GuildMessage,
  globals: ClientGlobals,
  overrides?: { user?: boolean; role?: boolean; channel?: boolean }
) {
  const { lotusConfig, orm } = globals
  if (command.ownerOnly) return lotusConfig.ownerIds.includes(message.author.id)
  if (message.member?.permissions.has(PermissionsBitField.Flags.Administrator))
    return true

  const rows = (
    await orm.findAll(PermSchema, {
      where: { command: command.name, guild: message.guild!.id }
    })
  ).sort(
    (a, b) =>
      orderCategory.indexOf(a.category) - orderCategory.indexOf(b.category) ||
      orderType.indexOf(a.type) - orderType.indexOf(b.type) ||
      a.createdAt.getTime() - b.createdAt.getTime()
  )

  if (rows.length === 0) return true

  const { user = false, role = false, channel = false } = overrides || {}
  for (const row of rows) {
    const { type, category, name } = row
    const match =
      (category === 'user' && (message.author.id === name || user)) ||
      (category === 'role' &&
        (message.member?.roles.cache.find((r) => r.name === name) || role)) ||
      (category === 'channel' &&
        ('name' in message.channel ? message.channel.name === name : channel))

    if (match) return type === 'allow'
  }

  return false
}
