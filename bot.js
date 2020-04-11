/* global require */
const { Client, Collection } = require('discord.js')
var merge = require('merge-objects')
const client = new Client({ partials: ['MESSAGE', 'CHANNEL'] })
client.commands = new Collection()
client.config = { modules: [] }

var argv = require('minimist')(process.argv.slice(2))
const path = require('path')
const fs = require('fs-extra')
const glob = require('glob')

const Sqlite = require('better-sqlite3')
const db = new Sqlite('lotus/database.db')

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

var util = require('./utilities.js')
const tokens = require('./lotus/tokens.json')
const repos = require('./lotus/modules.json')

loadConfig(client)

module.exports = async function () {
  const eventModules = {}
  const commandHandlerCommands = require('./commandHandler/commands')
  const commandHandlerEvents = require('./commandHandler/events')
  Object.keys(commandHandlerCommands).forEach(commandName => {
    const command = commandHandlerCommands[commandName]
    client.commands.set(commandName, command)
    client.commands.get(commandName).module = 'commandHandler'

    if (command.alias) {
      command.alias.forEach(alias => {
        client.commands.set(alias, command)
      })
    }
  })
  Object.keys(commandHandlerEvents).forEach(eventName => {
    if (!eventModules[eventName]) eventModules[eventName] = []
    eventModules[eventName].push({ func: commandHandlerEvents[eventName], module: 'commandHandler' })
  })

  client.config.modules.push('commandHandler')

  repos.forEach(repo => {
    repo.modules.forEach(moduleName => {
      try {
        let commands; let requirements; let events
        const message = []

        if (fs.existsSync(path.join(repo.path, moduleName, 'commands.js'))) commands = require(path.join(repo.path, moduleName, 'commands.js'))
        if (fs.existsSync(path.join(repo.path, moduleName, 'events.js'))) events = require(path.join(repo.path, moduleName, 'events.js'))
        if (fs.existsSync(path.join(repo.path, moduleName, 'requirements.js'))) requirements = require(path.join(repo.path, moduleName, 'requirements.js'))

        if (requirements) requirements(client, db)
        if (commands) {
          Object.keys(commands).forEach(commandName => {
            const command = commands[commandName]
            client.commands.set(commandName, command)
            client.commands.get(commandName).module = moduleName

            if (command.alias) {
              command.alias.forEach(alias => {
                client.commands.set(alias, command)
              })
            }
          })
          message.push(`${Object.keys(commands).length} commands`)
        }
        if (events) {
          Object.keys(events).forEach(eventName => {
            if (!eventModules[eventName]) eventModules[eventName] = []
            eventModules[eventName].push({ func: events[eventName], module: moduleName })
          })
          message.push(`${Object.keys(events).length} events`)
        }

        client.config.modules.push(moduleName)

        console.log(`Loaded module ${moduleName} with ${message.join(' and ')}`)
      } catch (e) {
        console.log(`\nFailed to load ${moduleName}\n${e.stack}\n`)
      }
    })
  })

  Object.keys(eventModules).forEach(eventName => {
    client.on(eventName, (...args) => {
      eventModules[eventName].forEach(item => {
        item.func(client, db, item.module, ...args)
      })
    })
  })

  process.on('unhandledRejection', err => {
    if (err.message !== 'Unknown User') util.log(client, err.stack)
  })

  client.login(tokens.discord).then(() => console.log('Logged in!'))

  if (argv.d) {
    client.on('debug', function (info) {
      console.log(`debug -> ${info}`)
    })
  }
}

function loadConfig (client) {
  const configFiles = glob.sync('config/**', { nodir: true })
  for (const file of configFiles) {
    if (!file.endsWith('.json')) continue
    const config = require(`./${file}`)

    const pathArray = file.split('/')
    merge(client, getDeep(config, pathArray))
  }
}

function getDeep (config, splitArray) {
  const result = {}
  let name = splitArray.shift()

  if (splitArray.length === 0) {
    name = name.replace('.json', '')
    if (!name.endsWith('.example')) result[name] = config
  } else {
    result[name] = getDeep(config, splitArray)
  }

  return result
}
