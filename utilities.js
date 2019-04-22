
const Discord = require('discord.js')
let config = require('./data/config.js')
let { ownerGuild } = config

var fs = require('fs-extra')

module.exports = {
  checkGuild (db, guild, moduleName) {
    return db.prepare('SELECT state FROM modules WHERE guild=? AND module=?').get(guild.id, moduleName).state === '1'
  },
  async permCheck (message, moduleName, commandName, client, db, extra = false) {
    let command = client.commands.get(commandName)
    if (command && command.config && command.config.ownerOnly) {
      if (config.ownerId) return config.ownerId === message.author.id
      else {
        let app = await client.fetchApplication()

        if (extra) return { allowed: app.owner.id === message.author.id }
        else return app.owner.id === message.author.id
      }
    } else {
      if (moduleName && db.prepare('SELECT state FROM modules WHERE module=? AND guild=?').get(moduleName, message.guild.id).state === '0') {
        if (extra) return { allowed: false }
        else return false
      }
      if (moduleName && db.prepare('SELECT state FROM commands WHERE command=? AND guild=?').get(commandName, message.guild.id).state === '0') {
        if (extra) return { allowed: false }
        else return false
      }

      let dbPerms = db.prepare('SELECT type,perm FROM perms WHERE command=? AND guild=?').all(commandName, message.guild.id)
      if (dbPerms.length === 0) {
        if (extra) return { allowed: true }
        else return true
      }
      let perms = { role: [], user: [], channel: [] }
      dbPerms.forEach(element => {
        perms[element.type].push(element.perm)
      })

      if (perms.channel.length === 0 || perms.channel.includes(message.channel.name) || extra) {
        let infoOut = { allowed: true }
        if (perms.channel.length > 0) infoOut.channel = perms.channel
        if (perms.role.length === 0 && perms.user.length === 0) {
          if (extra) return infoOut
          else return true
        }
        if (perms.role.length > 0 && message.member.roles.some(r => perms.role.includes(r.name))) {
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
