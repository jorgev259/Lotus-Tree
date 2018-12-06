
const Discord = require('discord.js')

var fs = require('fs-extra')

module.exports = {
  permCheck (message, commandName, client, db) {
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
      client.channels.get('478591298241036328').send({ embed: new Discord.MessageEmbed().setTimestamp().setDescription(log) })
    }
  }
}
