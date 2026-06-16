import type { APIEmbedField } from 'discord.js'
import type { CommandGroup, PackageModule, ReadyCommand } from '../../index.ts'
import {
  CommandSchema,
  ConfigSchema,
  ModuleSchema,
  PermSchema
} from './models.ts'
import { permCheck } from './util.ts'

const commands: CommandGroup = {
  help: {
    usage: 'help [command]',
    desc: 'This command displays information about a command',
    example: 'help perms',
    async execute(globals, ...args) {
      const [message] = args
      if (!message.guild) return

      const { config, param, commands, orm } = globals
      const { prefix } = config[message.guild.id]!

      async function evalCommand(command: ReadyCommand) {
        const permData = await permCheck(command, message, globals, {
          channel: true
        })

        if (permData && command.desc) {
          const channelPerms = await orm.findAll(PermSchema, {
            where: {
              type: 'allow',
              category: 'channel',
              command: command.name,
              guild: message.guild!.id
            }
          })

          const keys = (
            await orm.findAll(ConfigSchema, {
              fields: ['item'],
              groupBy: 'item'
            })
          )
            .map((c) => c.item)
            .join('/')
          const usage = command.usage
            ? command.usage.replace('lotus-configs', keys)
            : ''

          let result = `${command.desc}.`
          if (command.usage) result += `\nUsage: ${prefix}${usage}`
          if (command.example)
            result += `\nExample: ${prefix}${command.example}`
          if (channelPerms.length > 0)
            result += `\n(Usable on: ${channelPerms.map((e) => `#${e.name}`).join(' ')})`

          return result
        }
      }

      if (param[1]) {
        const name = param[1].toLowerCase()
        if (
          commands.has(name) &&
          (commands.get(name)?.usage || commands.get(name)?.desc)
        ) {
          const command = commands.get(name)!
          const result = await evalCommand(command)

          if (result) message.channel.send(result)
        }
      } else {
        const fields = []
        for (const [name, command] of commands.entries()) {
          const value = await evalCommand(command)
          if (value) fields.push({ name, value })
        }

        const embed = { fields }
        message.author.send({ embeds: [embed] })
      }
    }
  },

  about: {
    desc: 'Info about the bot',
    async execute({ client, lotusConfig, modules }, message) {
      const abouts = [...modules.values()]
        .filter((m): m is PackageModule & { about: APIEmbedField } => !!m.about)
        .map((m) => m.about)

      message.channel.send({
        embeds: [
          {
            title: 'About',
            description: `Powered by [Lotus Tree](https://github.com/jorgev259/Lotus-Tree) (Source code available).
          Report any issues on [this link](https://github.com/jorgev259/Lotus-Tree/issues).\n
          ${client.application?.botPublic ? `[Add me to your server!](https://discordapp.com/oauth2/authorize?client_id=${client.application.id}&scope=bot&permissions=${lotusConfig.permissions})` : ''}`,
            color: 16150617,
            thumbnail: {
              url: 'https://pbs.twimg.com/profile_images/1178168868348542976/nGgmZHKv_400x400.jpg'
            },
            fields: [
              {
                name: 'Developed by',
                value:
                  'ChitoWarlock (Chito#2869) ([Github](https://github.com/jorgev259)) ([Twitter](https://twitter.com/ChitoWarlock))'
              },
              ...abouts,
              {
                name: 'Throw me a bone! or something',
                value:
                  '[Paypal](https://paypal.me/chitowarlock) or [Ko-Fi](https://Ko-fi.com/E1E8I3VN)'
              }
            ]
          }
        ]
      })
    }
  },

  perms: {
    desc: 'Adds a permission entry to a command',
    usage: 'perms [command name] <allow/deny> <@user|roleName|#channel>',
    example: 'perms config allow Staff',
    async execute({ orm, param, commands }, message) {
      if (!message.guildId) return
      if (param.length < 4)
        return message.channel.send('Not enough parameters.')

      const name = param[1]!.toLowerCase()
      const type = param[2]!.toLowerCase()
      param = param.slice(3)

      if (!commands.has(name))
        return message.channel.send(`\`${name}\` is not a valid command`)

      let category
      let nameId = ''

      if (message.mentions.users.size > 0) {
        category = 'user'
        nameId = message.mentions.users.first()!.id
      } else if (message.mentions.channels.size > 0) {
        category = 'channel'
        nameId = (message.mentions.channels.first()! as { name: string }).name
      } else {
        if (!message.guild!.roles.cache.some((r) => r.name === param.join(' ')))
          return message.channel.send(
            `The role \`${param.join(' ')}\` doesnt exist.`
          )
        category = 'role'
        nameId = param.join(' ')
      }

      await orm.create(PermSchema, {
        guild: message.guildId,
        command: name,
        category,
        type,
        name: nameId
      })
      await orm.flush()
      await message.channel.send('Permissions updated')
    }
  },

  modules: {
    desc: 'Displays all commands and modules available',
    async execute({ commands, modules }, message) {
      if (!message.guildId || message.guildId === null) return
      const fields = []

      for (const module of modules.values()) {
        const commandList = module.commandNames.map((c) => commands.get(c))
        const valueOut = commandList
          .map(
            (c) =>
              `${c?.name}${c?.enabled[message.guildId as string] ? '' : ' (disabled)'}`
          )
          .join('\n')
        fields.push({
          name: `${module.name}${module.enabled[message.guildId] ? '' : ' (disabled)'}`,
          value: valueOut || '\u200B'
        })
      }

      const embed = {
        title: 'Available Commands (per module)',
        color: 4128386,
        fields
      }
      message.channel.send({ embeds: [embed] })
    }
  },

  toggle: {
    usage: 'toggle [module/command] [command name]',
    desc: 'Enables or disables a command/module',
    example: 'toggle command about',
    async execute({ param, orm, commands, modules }, message) {
      if (!message.guildId || message.guildId === null) return
      if (!param[2] || !['module', 'command'].includes(param[1]!.toLowerCase()))
        return message.channel.send('Usage: toggle [module/command] [name]')

      const mode = param[1]!.toLowerCase()
      const id = param[2]!.toLowerCase()

      switch (mode) {
        case 'module': {
          const commandList = Array.from(commands.values()).filter(
            (c) => c.moduleName === id
          )
          if (commandList.length === 0)
            return message.channel.send(`${id} is not a valid module name`)

          const module = modules.get(id)
          if (!module) return

          await orm.nativeUpdate(
            ModuleSchema,
            {
              module: id,
              guild: message.guildId
            },
            { value: !module.enabled[message.guildId as string] }
          )
          module.enabled[message.guildId] = !module.enabled[message.guildId]

          await message.channel.send(
            `The module '${id}' has been ${module.enabled[message.guildId] ? 'enabled' : 'disabled'}.`
          )
          break
        }

        case 'command': {
          if (!commands.has(id))
            return message.channel.send(`${id} is not a valid command name.`)
          const command = commands.get(id)

          if (!command) return
          const module = modules.get(command.moduleName)

          await orm.nativeUpdate(
            CommandSchema,
            {
              command: id,
              guild: message.guildId
            },
            { value: !command.enabled[message.guildId] }
          )
          command.enabled[message.guildId] = !command.enabled[message.guildId]

          await message.channel.send(
            `The module '${id}' has been ${command.enabled[message.guildId] ? 'enabled' : 'disabled'}.${command.enabled[message.guildId] && module && !module.enabled[message.guildId] ? `\nEnable the module '${module.name}' to use this command.` : ''}`
          )
          break
        }
      }
    }
  },

  config: {
    usage: 'config [lotus-configs] [value]',
    desc: 'Changes a bot configuration',
    example: 'config prefix >',
    async execute({ param, orm, config }, message) {
      if (!message.guildId || message.guildId === null) return
      const item = param[1]!.toLowerCase()
      const keys = (
        await orm.findAll(ConfigSchema, { fields: ['item'], groupBy: 'item' })
      ).map((c) => c.item)

      if (!keys.includes(item))
        return message.channel.send(
          `'${item}' is not a valid option. Options: ${keys.join(', ')}`
        )
      const data = param.slice(2).join(' ')

      await orm.nativeUpdate(
        ConfigSchema,
        { guild: message.guildId, item },
        { value: data }
      )
      config[message.guildId]![item] = data
      await message.channel.send('Settings updated')
    }
  }
}

export default commands
