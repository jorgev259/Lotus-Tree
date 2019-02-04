var util = require('../../utilities.js')

module.exports = {
  events: {
    ready (client, db, module) {
      client.guilds.forEach(guild => {
        checkGuild(client, db, guild)
      })
    },
    guildCreate (client, db, guild) {
      checkGuild(client, db, guild)
    },
    async message (client, db, moduleName, message) {
      if (!message.member) return
      var prefix = '>'

      if (message.content.startsWith(prefix) || message.content.startsWith('<@' + client.user.id + '>')) {
        var param = message.content.split(' ')

        if (message.content.startsWith(prefix)) {
          param[0] = param[0].split(prefix)[1]
        } else {
          param.splice(0, 1)
        }

        const commandName = param[0].toLowerCase()
        var command = db.prepare('SELECT * FROM customs WHERE guild=? AND name=?').get(message.guild.id, commandName)

        let identifier
        if (command === undefined) {
          identifier = param[0].toLowerCase()
        } else identifier = command.type

        if (!client.commands.has(identifier)) return
        if (command === undefined) command = client.commands.get(identifier)

        if (await util.permCheck(message, command.module, commandName, client, db)) {
          client.commands.get(identifier).execute(client, message, param, db, command.module)
        }
      }
    }
  }
}

function checkGuild (client, db, guild) {
  console.log(client.data.moduleNames)
  client.data.moduleNames.forEach(module => {
    db.prepare('INSERT OR IGNORE INTO modules (guild,module,state) VALUES (?,?,false)').run(guild.id, module)
  })

  for (let commandName of client.commands.keys()) {
    let command = client.commands.get(commandName)
    if (command.module) db.prepare('INSERT OR IGNORE INTO commands (guild,command,state,module) VALUES (?,?,true,?)').run(guild.id, commandName, command.module)
  }
}
