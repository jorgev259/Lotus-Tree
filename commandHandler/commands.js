/* eslint-disable no-eval */
var util = require('../utilities.js')
const { defaultConfig } = require('../lotus/config.json')
const { MessageEmbed } = require('discord.js')

module.exports = {
  config: {
    usage: `config [${Object.keys(defaultConfig).join('/')}] [value]`,
    desc: 'Changes a bot configuration.',
    async execute (client, msg, param, sequelize) {
      const option = param[1].toLowerCase()
      const keys = Object.keys(defaultConfig)

      if (!keys.includes(option)) return msg.channel.send(`'${option}' is not a valid option. Options: ${keys.join(', ')}`)
      const data = param.slice(2).join(' ')

      const row = await sequelize.models.config.findOne({ where: { guild: msg.guild.id, item: option } })
      row.value = data
      await row.save()

      msg.channel.send('Settings updated')
    }
  },

  toggle: {
    usage: 'toggle [module/command] [name]',
    desc: 'Enables or disables a command/module.',
    async execute (client, msg, param, sequelize) {
      if (!param[1] || !param[2]) return msg.channel.send('Usage: toggle [module/command] [name]')
      const mode = param[1].toLowerCase()
      if (!['module', 'command'].includes(mode)) return msg.channel.send(`${mode} is not a valid option`)

      const id = param[2].toLowerCase()
      const { module, command } = sequelize.models

      switch (mode) {
        case 'module': {
          const row = await module.findOne({ where: { module: id, guild: msg.guild.id } })
          row.value = !row.value
          await row.save()
          msg.channel.send(`The module '${id}' has been ${row.value ? 'enabled' : 'disabled'}.`)
          break
        }

        case 'command': {
          const row = await command.findOne({ where: { command: id, guild: msg.guild.id } })
          if (!row) return msg.channel.send(`${id} is not a valid command name.`)

          row.value = !row.value
          await row.save()

          const { value } = await module.findOne({ where: { module: row.module, guild: msg.guild.id } })
          msg.channel.send(`The module '${id}' has been ${row.value ? 'enabled' : 'disabled'}.${row.value && !value ? `\nEnable the module '${row.module}' to use this command.` : ''}`)
          break
        }
      }
    }
  },
  help: {
    usage: 'help [command]',
    desc: 'This command displays information about a command.',
    async execute (client, message, param, sequelize) {
      const { value: prefix } = await sequelize.models.config.findOne({ where: { guild: message.guild.id, item: 'prefix' } })

      if (param[1]) {
        const name = param[1].toLowerCase()
        if (
          client.commands.has(name) &&
            (client.commands.get(name).usage || client.commands.get(name).desc)
        ) {
          const command = client.commands.get(param[1].toLowerCase())
          const permData = await util.permCheck(message, command.module, param[1].toLowerCase(), client, sequelize, true)
          if (permData.allowed && command.desc) {
            message.channel.send(`${command.desc}${command.usage ? ` Usage: ${prefix}${command.usage}` : ''}${permData.channel ? ` (Usable on: ${permData.channel.map(e => `#${e}`).join(' ')})` : ''}`)
          }
        }
      } else {
        const fields = (await Promise.all(Array.from(client.commands.keys()).map(async idName => {
          const command = client.commands.get(idName)
          const permData = await util.permCheck(message, command.module, idName, client, sequelize, true)
          if (permData.allowed && command.desc) {
            return {
              name: idName,
              value: `${command.desc}${command.usage ? ` Usage: ${prefix}${command.usage}` : ''}${permData.channel ? ` (Usable on: ${permData.channel.map(e => `#${e}`).join(' ')})` : ''}`
            }
          }
        }))).filter(e => e !== undefined)

        const embed = { fields: fields }
        message.author.send({ embed })
      }
    }
  },

  restart: {
    desc: 'Restarts the bot',
    config: {
      ownerOnly: true
    },
    async execute (client, msg) {
      await msg.channel.send('Restarting...')
      await client.user.setActivity('Restarting...', { type: 'PLAYING' })
      process.exit()
    }
  },

  eval: {
    desc: 'Runs any code (DANGEROUS)',
    config: {
      ownerOnly: true
    },
    async execute (client, msg, param) {
      console.log(param.slice(1).join(' '))
      const result = eval(param.slice(1).join(' '))
      console.log(result)
      msg.channel.send(result || 'Completed!')
    }
  },

  sql: {
    desc: 'Runs a sql query against the database.',
    usage: 'sql [query]',
    config: {
      ownerOnly: true
    },
    async execute (client, msg, param, sequelize) {
      try {
        const [result] = await sequelize.query(param.slice(1).join(' '))
        msg.channel.send(`\`\`\`${JSON.stringify(result, null, 2)}\`\`\``)
      } catch (err) {
        console.log(err)
        msg.channel.send('Something went wrong!')
      }
    }
  },

  commands: {
    desc: 'Displays all commands and modules available',
    async execute (client, msg, param, sequelize) {
      const { module, command } = sequelize.models

      const modules = await module.findAll({ where: { guild: msg.guild.id } })
      const fields = await Promise.all(modules.map(async ({ module, value }) => {
        const commands = await command.findAll({ where: { module, guild: msg.guild.id } })
        return {
          name: `${module}${value ? '' : ' (disabled)'}`,
          value: commands.map(({ command, value }) => `${command}${value ? '' : ' (disabled)'}`).join('\n') || '\u200B'
        }
      }))

      const embed = {
        title: 'Available Commands (per module)',
        color: 4128386,
        fields: fields
      }
      msg.channel.send({ embed })
    }
  },

  about: {
    desc: 'Info about the bot',
    async execute (client, message, param, db) {
      message.channel.send({
        embed: {
          title: 'About',
          description: 'Powered by [Lotus Tree](https://github.com/jorgev259/Lotus-Tree) (Source code available).\nReport any issues on [this link](https://github.com/jorgev259/Lotus-Tree/issues).\n\n[Add me to your server!](https://discordapp.com/oauth2/authorize?client_id=477560851172294657&scope=bot&permissions=1)',
          color: 16150617,
          thumbnail: {
            url: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/intermediary/f/e65e21bd-dc77-499e-962a-fa13cab37fc2/d7rwh84-d70dd9c5-1de9-4ebd-b3bb-78d9f517e230.jpg/v1/fill/w_894,h_894,q_70,strp/p3p_sketch_by_kuvshinov_ilya_d7rwh84-pre.jpg'
          },
          fields: [
            {
              name: 'Developed by',
              value: 'Jorge Vargas (George#3333) ([Github](https://github.com/jorgev259))'
            },
            {
              name: 'Throw me a bone! or something',
              value: '[Paypal](https://paypal.me/chitothelickeddorito) or [Ko-Fi](https://Ko-fi.com/E1E8I3VN)'
            }
          ]
        }
      })
    }
  },

  perms: {
    desc: 'Adds, removes or lists permissions to a command.',
    usage: 'perms [command] <add│remove|list> <#channel│@user│roleName>',
    async execute (client, message, param, sequelize) {
      var name = param[1].toLowerCase()
      var type = param[2].toLowerCase()
      param = param.slice(3)

      if (!client.commands.has(name)) return message.channel.send(`\`${name}\` is not a valid command`)

      const { perm } = sequelize.models

      switch (type) {
        case 'add': {
          const data = { guild: message.guild.id, command: name }
          if (message.mentions.users.size > 0) {
            data.type = 'user'
            data.perm = message.mentions.users.first().id
          } else if (message.mentions.channels.size > 0) {
            data.type = 'channel'
            data.perm = message.mentions.channels.first().name
          } else {
            if (!message.guild.roles.cache.some(r => r.name === param.join(' '))) return message.channel.send(`The role \`${param.join(' ')}\` doesnt exist.`)
            data.type = 'role'
            data.perm = param.join(' ')
          }

          await perm.create(data)
          message.reply(param.join(' ') + ' is now allowed to use ' + name)
          break
        }

        case 'remove': {
          const data = { guild: message.guild.id, command: name }
          if (message.mentions.users.size > 0) {
            data.type = 'user'
            data.perm = message.mentions.users.first().id
          } else if (message.mentions.channels.size > 0) {
            data.type = 'channel'
            data.perm = message.mentions.channels.first().name
          } else {
            if (!message.guild.roles.cache.some(r => r.name === param.join(' '))) return message.channel.send(`The role \`${param.join(' ')}\` doesnt exist.`)
            data.type = 'role'
            data.perm = param.join(' ')
          }

          await perm.destroy({ where: data })
          message.reply('Removed ' + param.join(' ') + ' from the command ' + name)
          break
        }

        case 'list': {
          const dbPerms = await perm.findAll({ where: { guild: message.guild.id, command: name } })

          const perms = {}
          dbPerms.forEach(element => {
            if (!perms[element.type]) perms[element.type] = []
            perms[element.type].push(element.perm)
          })

          const types = Object.keys(perms)
          if (types.length === 0) return message.channel.send(`No permissions set (Anyone can use \`${name}\`!)`)

          const embed = new MessageEmbed()
            .setTitle(`${name} permissions`)

          for (let i = 0; i < types.length; i++) {
            embed.addField(types[i], perms[types[i]].join('\n'))
            if (i !== types.length - 1) embed.addBlankField()
          }

          message.channel.send(embed)
          break
        }
      }
    }
  }
}
