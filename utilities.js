
const Discord = require('discord.js')
let { ownerGuild } = require('./data/config.js')

var fs = require('fs-extra')

module.exports = {
  checkGuild (db, guild, moduleName) {
    return db.prepare('SELECT state FROM modules WHERE guild=? AND module=?').get(guild.id, moduleName).state === '1'
  },
  async permCheck (message, moduleName, commandName, client, db) {
    let command = client.commands.get(commandName)
    if (command.config.ownerOnly) {
      let app = await client.fetchApplication()
      return app.owner.id === message.author.id
    } else {
      if (moduleName && db.prepare('SELECT state FROM modules WHERE module=? AND guild=?').get(moduleName, message.guild.id).state === '0') return false
      if (moduleName && db.prepare('SELECT state FROM commands WHERE command=? AND guild=?').get(commandName, message.guild.id).state === '0') return false

      let dbPerms = db.prepare('SELECT type,perm FROM perms WHERE command=? AND guild=?').all(commandName, message.guild.id)
      if (dbPerms.length === 0) return true
      let perms = { role: [], user: [], channel: [] }
      dbPerms.forEach(element => {
        perms[element.type].push(element.perm)
      })

      if (perms.channel.length === 0 || perms.channel.includes(message.channel.name)) {
        if (perms.role.length > 0 && message.member.roles.some(r => perms.role.includes(r.name))) return true

        if (perms.user.length > 0 && perms.user.includes(message.author.id)) return true
      }

      return false
    }
  },

  async checkData (client, name, info) {
    if (!(await fs.pathExists(`data/${name}.json`))) {
      // file does not exist
      client.data[name] = info
      fs.writeFileSync(`data/${name}.json`, JSON.stringify(client.data[name], null, 4))
    }
  },

  async save (data, name) {
    await fs.writeFile('data/' + name + '.json', JSON.stringify(data, null, 4))
  },

  log: function (client, log) {
    console.log(log)
    if (client != null && client.channels.size > 0 && client.readyAt != null) {
      client.guilds.get(ownerGuild).channels.find(c => c.name === 'error-logs').send({ embed: new Discord.MessageEmbed().setTimestamp().setDescription(log) })
    }
  }
}
