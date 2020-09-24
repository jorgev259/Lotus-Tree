
const Discord = require('discord.js')
const { ownerGuild, owners } = require('./lotus/config.json')

var fs = require('fs-extra')

module.exports = {
  async checkGuild (sequelize, guild, moduleName) {
    const { value } = await sequelize.models.module.findOne({ where: { command: moduleName, guild: guild.id } })
    return value
  },
  async permCheck (message, moduleName, commandName, client, sequelize, extra = false) {
    const command = client.commands.get(commandName)
    if (command && command.config && command.config.ownerOnly) {
      if (owners) return owners.includes(message.author.id)
      else {
        const app = await client.fetchApplication()

        if (extra) return { allowed: app.owner.id === message.author.id }
        else return app.owner.id === message.author.id
      }
    } else {
      const { module, command: commandModel, perm } = sequelize.models
      const { value: moduleValue } = await module.findOne({ where: { module: moduleName, guild: message.guild.id } })
      const { value: commandValue } = await commandModel.findOne({ where: { command: commandName, guild: message.guild.id } })

      if (moduleName && !moduleValue) {
        if (extra) return { allowed: false }
        else return false
      }
      if (moduleName && !commandValue) {
        if (extra) return { allowed: false }
        else return false
      }

      const dbPerms = await perm.findAll({ where: { command: commandName, guild: message.guild.id } })
      if (dbPerms.length === 0) {
        if (extra) return { allowed: true }
        else return true
      }
      const perms = { role: [], user: [], channel: [] }
      dbPerms.forEach(element => {
        perms[element.type].push(element.perm)
      })

      if (perms.channel.length === 0 || perms.channel.includes(message.channel.name) || extra) {
        const infoOut = { allowed: true }
        if (perms.channel.length > 0) infoOut.channel = perms.channel
        if (perms.role.length === 0 && perms.user.length === 0) {
          if (extra) return infoOut
          else return true
        }
        if (perms.role.length > 0 && message.member.roles.cache.some(r => perms.role.includes(r.name))) {
          if (extra) return infoOut
          else return true
        }

        if (perms.user.length > 0 && perms.user.includes(message.author.id)) {
          if (extra) return infoOut
          else return true
        }
      }

      if (extra) return { allowed: false }
      else return false
    }
  },

  async checkData (client, name, info) {
    if (!(await fs.pathExists(`config/${name}.json`))) {
      // file does not exist
      client.data[name] = info
      fs.writeFileSync(`config/${name}.json`, JSON.stringify(client.data[name], null, 4))
    }
  },

  async save (data, name) {
    await fs.writeFile('config/' + name + '.json', JSON.stringify(data, null, 4))
  },

  log: function (client, log) {
    console.log(log)
    if (client != null && client.channels.cache.size > 0 && client.readyAt != null) {
      client.guilds.cache.get(ownerGuild).channels.cache.find(c => c.name === 'error-logs').send({ embed: new Discord.MessageEmbed().setTimestamp().setDescription(log) })
    }
  }
}
