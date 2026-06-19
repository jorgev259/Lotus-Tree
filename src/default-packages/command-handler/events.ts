import { Events, Guild } from 'discord.js'

import { checkGuildConfig, permCheck } from './util.ts'
import type { LotusEvents, PackageModule } from '../../index.ts'

const events: LotusEvents = {
  [Events.GuildCreate]: (globals, guild: Guild) =>
    checkGuildConfig(guild.id, globals),
  [Events.ClientReady]: async (globals) => {
    const { client } = globals

    const guilds = await client.guilds.fetch()
    guilds.forEach((guild) => checkGuildConfig(guild.id, globals))
  },
  [Events.MessageCreate]: async (globals, ...args) => {
    const [message] = args
    const { client, commands, modules, config, localConfig } = globals
    if (message.author.id === client.user?.id || !message.member) return

    const guildId = message.guildId
    if (!guildId) return

    const prefix = config[guildId]!['prefix']
    const botMention = client.user?.toString()

    const startsPrefix = message.content.startsWith(prefix)
    const startsMention = botMention && message.content.startsWith(botMention)

    if (!startsPrefix && !startsMention) return

    let param: string[] = []
    let commandName = 'Unknown command name'

    if (message.content.startsWith(prefix)) {
      param = message.content.trim().split(' ')
      commandName =
        param[0]!.toLowerCase().substring(prefix.length) ||
        'Unknown command name'
    }

    if (botMention && message.content.startsWith(botMention)) {
      param = message.content.replace(botMention, '').trim().split(' ')
      commandName = param[0]!.toLowerCase()
    }

    if (!commands.has(commandName)) return
    const command = commands.get(commandName)

    if (!command) return
    const { moduleName } = command
    const module = modules.get(moduleName) as PackageModule

    if (
      module.enabled[guildId] &&
      command.enabled[guildId] &&
      (await permCheck(command, message, globals))
    ) {
      command.execute(
        //@ts-expect-error untested feature
        { ...globals, param, localConfig: localConfig[moduleName]! },
        ...args
      )
    }
  }
}

export default events
