var util = require('../../utilities.js')
const { defaultConfig } = require('../../data/lotus/config.json')

module.exports = {
  events: {
    ready (client, db, module) {
      client.guilds.cache.forEach(guild => {
        checkGuild(client, db, guild)
      })
      client.user.setActivity(`${defaultConfig.prefix}help`, { type: 'PLAYING' })
    },
    guildCreate (client, db, guild) {
      checkGuild(client, db, guild)
    },
    async message (client, db, moduleName, message) {
      if (!message.member) return
      var prefix = db.prepare('SELECT value FROM config WHERE guild=? AND type=?').get(message.guild.id, 'prefix').value

      if (message.content.startsWith(prefix) || message.content.startsWith('<@' + client.user.id + '>')) {
        var param = message.content.split(' ')

        if (message.content.startsWith(prefix)) {
          param[0] = param[0].split(prefix)[1]
        } else {
          param.splice(0, 1)
        }

        const commandName = param[0].toLowerCase()

        if (!client.commands.has(commandName)) return
        const command = client.commands.get(commandName)

        if (await util.permCheck(message, command.module, commandName, client, db)) {
          client.commands.get(commandName).execute(client, message, param, db, command.module)
        }
      }
    }
  }
}

function checkGuild (client, db, guild) {
  Object.keys(client.data.moduleConfig).forEach(moduleName => {
    let state = false

    if (client.data.moduleConfig[moduleName].default) state = client.data.moduleConfig[moduleName].default
    db.prepare('INSERT OR IGNORE INTO modules (guild,module,state) VALUES (?,?,?)').run(guild.id, moduleName, state ? '1' : '0')
  })

  for (const commandName of client.commands.keys()) {
    const command = client.commands.get(commandName)
    if (command.module) db.prepare('INSERT OR IGNORE INTO commands (guild,command,state,module) VALUES (?,?,true,?)').run(guild.id, commandName, command.module)
  }

  Object.keys(defaultConfig).forEach(key => db.prepare('INSERT OR IGNORE INTO config (guild,type,value) VALUES (?,?,?)').run(guild.id, key, defaultConfig[key]))
}
