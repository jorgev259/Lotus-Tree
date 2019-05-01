const pm2 = require('pm2')
var util = require('../../utilities.js')
const config = require('../../data/config.js')
const { MessageEmbed } = require('discord.js')

module.exports = {
  config: {
    default: true
  },
  async reqs (client, db, moduleName) {
    db.prepare(
      'CREATE TABLE IF NOT EXISTS config (guild TEXT, type TEXT, value TEXT, PRIMARY KEY(`guild`,`type`))'
    ).run()
    db.prepare(
      'CREATE TABLE IF NOT EXISTS modules (guild TEXT, module TEXT, state TEXT, PRIMARY KEY(`guild`,`module`))'
    ).run()
    db.prepare(
      'CREATE TABLE IF NOT EXISTS commands (guild TEXT, command TEXT, module TEXT, state TEXT, PRIMARY KEY(`guild`,`command`))'
    ).run()
    db.prepare(
      'CREATE TABLE IF NOT EXISTS perms (guild TEXT, command TEXT, type TEXT, perm TEXT)'
    ).run()
  },

  commands: {
    config: {
      usage: `config [${Object.keys(config.default).join('/')}] [value]`,
      desc: 'Changes a bot configuration.',
      async execute (client, msg, param, db) {
        let option = param[1].toLowerCase()
        if (!Object.keys(config.default).includes(option)) return msg.channel.send(`'${option}' is not a valid option. Options: ${Object.keys(config.default).join(', ')}`)
        let data = param.slice(2).join(' ')

        db.prepare('UPDATE config SET value = ? WHERE guild = ? AND type=?').run(data, msg.guild.id, option)
        // var channel = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(guild.id, 'twitter_channel').value
        msg.channel.send('Settings updated')
      }
    },

    toggle: {
      usage: 'toggle [module/command] [name]',
      desc: 'Enables or disables a command/module.',
      async execute (client, msg, param, db) {
        if (!param[1] || !param[2]) return msg.channel.send('Usage: toggle [module/command] [name]')
        let mode = param[1].toLowerCase()
        if (!['module', 'command'].includes(mode)) return msg.channel.send(`${mode} is not a valid option`)

        let id = param[2].toLowerCase()
        switch (mode) {
          case 'module':
            if (!Object.keys(client.data.moduleConfig).includes(id)) return msg.channel.send(`${id} is not a valid module name.\nModules: ${Object.keys(client.data.moduleConfig).join(', ')}.`)
            db.prepare('UPDATE modules SET state = NOT state WHERE module=? AND guild=?').run(id, msg.guild.id)
            msg.channel.send(`The module '${id}' has been ${db.prepare('SELECT state FROM modules WHERE module=? AND guild=?').get(id, msg.guild.id).state === '0' ? 'disabled' : 'enabled'}.`)
            break

          case 'command':
            let commands = db.prepare('SELECT command FROM commands').all().map(e => e.command)
            if (!commands.includes(id)) return msg.channel.send(`${id} is not a valid command name.\nCommands: ${commands.join(', ')}.`)

            db.prepare('UPDATE commands SET state = NOT state WHERE command=? AND guild=?').run(id, msg.guild.id)

            let data = db.prepare('SELECT c.state as cState, m.state as mState, m.module as module FROM commands c, modules m WHERE c.command=? AND c.guild=? AND c.module = m.module').get(id, msg.guild.id)
            msg.channel.send(`The module '${id}' has been ${data.cState === '0' ? 'disabled' : 'enabled'}.${data.mState === '0' && data.cState === '1' ? `\nEnable the module '${data.module}' to use this command.` : ''}`)
            break
        }
      }
    },
    help: {
      usage: 'help [command]',
      desc: 'This command displays information about a command.',
      async execute (client, message, param, db) {
        var prefix = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(message.guild.id, 'prefix').value
        if (param[1]) {
          let name = param[1].toLowerCase()
          if (
            client.commands.has(name) &&
            (client.commands.get(name).usage || client.commands.get(name).desc)
          ) {
            let command = client.commands.get(param[1].toLowerCase())
            let permData = await util.permCheck(message, command.module, param[1].toLowerCase(), client, db, true)
            if (permData.allowed && command.desc) {
              message.channel.send(`${command.desc}${command.usage ? ` Usage: ${prefix}${command.usage}` : ''}${permData.channel ? ` (Usable on: ${permData.channel.map(e => `#${e}`).join(' ')})` : ''}`)
            }
          }
        } else {
          let fields = (await Promise.all(Array.from(client.commands.keys()).map(async idName => {
            let command = client.commands.get(idName)
            let permData = await util.permCheck(message, command.module, idName, client, db, true)
            if (permData.allowed && command.desc) {
              return {
                name: idName,
                value: `${command.desc}${command.usage ? ` Usage: ${prefix}${command.usage}` : ''}${permData.channel ? ` (Usable on: ${permData.channel.map(e => `#${e}`).join(' ')})` : ''}`
              }
            }
          }))).filter(e => e !== undefined)

          let embed = { fields: fields }
          message.author.send({ embed })
        }
      }
    },

    restart: {
      desc: 'Restarts the bot',
      config: {
        ownerOnly: true
      },
      async execute (client, msg, param, db) {
        await msg.channel.send('Restarting...')
        await client.user.setActivity('Restarting...', { type: 'PLAYING' })
        process.exit()
      }
    },

    sql: {
      desc: 'Runs a sql query against the database.',
      usage: 'sql [query]',
      config: {
        ownerOnly: true
      },
      async execute (client, msg, param, db) {
        try {
          db.exec(param.slice(1).join(' '))
          msg.channel.send('Query finished')
        } catch (err) {
          console.log(err)
          msg.channel.send('Something went wrong!')
        }
      }
    },

    commands: {
      desc: 'Displays all commands and modules available',
      async execute (client, msg, param, db) {
        let fields = db.prepare('SELECT module as name,state FROM modules WHERE guild=?').all(msg.guild.id).map(function (module) {
          return {
            'name': `${module.name}${module.state === '0' ? ' (disabled)' : ''}`,
            'value': db.prepare('SELECT command as name,state FROM commands WHERE guild=? AND module=?').all(msg.guild.id, module.name).map(command => `${command.name}${command.state === '0' ? ' (disabled)' : ''}`).join('\n') || '\u200B'
          }
        })

        let embed = {
          'title': 'Available Commands (per module)',
          'color': 4128386,
          'fields': fields
        }
        msg.channel.send({ embed })
      }
    },

    about: {
      desc: 'Info about the bot',
      async execute (client, message, param, db) {
        message.channel.send({
          'embed': {
            'title': 'About',
            'description': 'Powered by [Lotus Tree](https://github.com/jorgev259/Lotus-Tree) (Source code available).\nReport any issues on [this link](https://github.com/jorgev259/Lotus-Tree/issues).\n\n[Add me to your server!](https://discordapp.com/oauth2/authorize?client_id=477560851172294657&scope=bot&permissions=1)',
            'color': 16150617,
            'thumbnail': {
              'url': 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/intermediary/f/e65e21bd-dc77-499e-962a-fa13cab37fc2/d7rwh84-d70dd9c5-1de9-4ebd-b3bb-78d9f517e230.jpg/v1/fill/w_894,h_894,q_70,strp/p3p_sketch_by_kuvshinov_ilya_d7rwh84-pre.jpg'
            },
            'fields': [
              {
                'name': 'Developed by',
                'value': 'Jorge Vargas (George#3333) ([Github](https://github.com/jorgev259))'
              },
              {
                'name': 'Throw me a bone! or something',
                'value': '[Paypal](https://paypal.me/chitothelickeddorito) or [Ko-Fi](https://Ko-fi.com/E1E8I3VN)'
              }
            ]
          }
        })
      }
    },

    perms: {
      desc: 'Adds, removes or lists permissions to a command.',
      usage: 'perms [command] <add│remove|list> <#channel│@user│roleName>',
      async execute (client, message, param, db) {
        var name = param[1].toLowerCase()
        var type = param[2].toLowerCase()
        param = param.slice(3)

        if (!client.commands.has(name)) return message.channel.send(`\`${name}\` is not a valid command`)

        switch (type) {
          case 'add':
            if (message.mentions.users.size > 0) {
              await db
                .prepare(
                  'INSERT INTO perms (guild,command,type,perm) VALUES (?,?,?,?)'
                )
                .run(
                  message.guild.id,
                  name,
                  'user',
                  message.mentions.users.first().id
                )
            } else if (message.mentions.channels.size > 0) {
              await db
                .prepare(
                  'INSERT INTO perms (guild,command,type,perm) VALUES (?,?,?,?)'
                )
                .run(
                  message.guild.id,
                  name,
                  'channel',
                  message.mentions.channels.first().name
                )
            } else {
              if (!message.guild.roles.some(r => r.name === param.join(' '))) return message.channel.send(`The role \`${param.join(' ')}\` doesnt exist.`)
              db.prepare('INSERT INTO perms (guild,command,type,perm) VALUES (?,?,?,?)').run(message.guild.id, name, 'role', param.join(' '))
            }
            message.reply(param.join(' ') + ' is now allowed to use ' + name)
            break

          case 'remove':
            if (message.mentions.users.size > 0) {
              await db
                .prepare(
                  "DELETE FROM perms WHERE guild=? AND command=? AND type='user' AND item=?"
                )
                .run(message.guild.id, name, message.mentions.users.first().id)
            } else if (message.mentions.channels.size > 0) {
              await db
                .prepare(
                  "DELETE FROM perms WHERE guild=? AND command=? AND type='channel' AND item=?"
                )
                .run(
                  message.guild.id,
                  name,
                  message.mentions.channels.first().name
                )
            } else {
              await db
                .prepare(
                  "DELETE FROM perms WHERE guild=? AND command=? AND type='role' AND item=?"
                )
                .run(message.guild.id, name, param.join(' '))
            }
            message.reply(
              'Removed ' + param.join(' ') + ' from the command ' + name
            )
            break

          case 'list':
            let dbPerms = db.prepare('SELECT type,perm FROM perms WHERE command=? AND guild=?').all(name, message.guild.id)

            let perms = {}
            dbPerms.forEach(element => {
              if (!perms[element.type]) perms[element.type] = []
              perms[element.type].push(element.perm)
            })

            let types = Object.keys(perms)
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
