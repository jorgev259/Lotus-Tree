var util = require('../../utilities.js')
const config = require('../../data/config.json')

module.exports = {
  events: {
    ready (client, db, module) {
      client.guilds.forEach(guild => {
        console.log(guild.available)
        checkGuild(client, db, guild)
      })
      client.user.setActivity(`${config.prefix}help`, { type: 'PLAYING' })
    },
    guildCreate (client, db, guild) {
      checkGuild(client, db, guild)
    },
    async message (client, db, moduleName, message) {
      if (!message.member) return
      var prefix = config.prefix

      if (message.content.startsWith(prefix) || message.content.startsWith('<@' + client.user.id + '>')) {
        var param = message.content.split(' ')

        if (message.content.startsWith(prefix)) {
          param[0] = param[0].split(prefix)[1]
        } else {
          param.splice(0, 1)
        }

        const commandName = param[0].toLowerCase()

        if (!client.commands.has(commandName)) return
        let command = client.commands.get(commandName)

        if (await util.permCheck(message, command.module, commandName, client, db)) {
          client.commands.get(commandName).execute(client, message, param, db, command.module)
        }
      }
    }
  }
}

function checkGuild (client, db, guild) {
  client.data.modules.forEach(moduleName => {
    let state = false
    if (client.data.moduleConfig[moduleName] && client.data.moduleConfig[moduleName].default && client.data.moduleConfig[moduleName].default) state = client.data.moduleConfig[moduleName].default
    db.prepare('INSERT OR IGNORE INTO modules (guild,module,state) VALUES (?,?,false)').run(guild.id, moduleName, state.toString())
  })

  for (let commandName of client.commands.keys()) {
    let command = client.commands.get(commandName)
    if (command.module) db.prepare('INSERT OR IGNORE INTO commands (guild,command,state,module) VALUES (?,?,true,?)').run(guild.id, commandName, command.module)
  }
}
