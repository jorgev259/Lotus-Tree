var util = require('../utilities.js')
const { defaultConfig } = require('../lotus/config.json')

module.exports = {
  ready (client, sequelize, module) {
    client.guilds.cache.forEach(guild => {
      checkGuild(client, sequelize, guild)
    })
    client.user.setActivity(`${defaultConfig.prefix}help`, { type: 'PLAYING' })
  },
  guildCreate (client, sequelize, guild) {
    checkGuild(client, sequelize, guild)
  },
  async message (client, sequelize, moduleName, message) {
    if (!message.member) return

    const { value: prefix } = await sequelize.models.config.findOne({ where: { guild: message.guild.id, item: 'prefix' } })

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

      if (await util.permCheck(message, command.module, commandName, client, sequelize)) {
        client.commands.get(commandName).execute(client, message, param, sequelize, command.module)
      }
    }
  }
}

function checkGuild (client, sequelize, guild) {
  const { command, module, config } = sequelize.models

  client.config.modules.forEach(moduleName => {
    module.findOrCreate({ where: { guild: guild.id, module: moduleName }, defaults: { value: moduleName === 'commandHandler' } })
  })

  for (const commandName of client.commands.keys()) {
    const commandData = client.commands.get(commandName)
    if (commandData.module) command.findOrCreate({ where: { guild: guild.id, command: commandName, module: commandData.module }, defaults: { value: true } })
  }

  Object.keys(defaultConfig).forEach(key => config.findOrCreate({ where: { guild: guild.id, item: key }, defaults: { value: defaultConfig[key] } }))
}
