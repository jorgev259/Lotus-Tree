const { Client, Collection } = require('discord.js')
const client = new Client({ partials: ['MESSAGE', 'CHANNEL'] })
client.commands = new Collection()
client.data = {}

const glob = require('glob')
let firstData = glob.sync(`data/*`)

const Sqlite = require('better-sqlite3')
let db = new Sqlite('data/database.db')

var util = require('./utilities.js')

loadData(client, firstData)

module.exports = async function () {
  let dataFiles = glob.sync(`data/*`)

  let modules = glob.sync(`modules/*/`)

  client.data = {}
  client.data.modules = []
  client.data.moduleConfig = {}

  let eventModules = {}
  let error = true
  for (const moduleFolder of modules) {
    let files = glob.sync(`${moduleFolder}/*`)

    let outModule = { commands: {}, events: {} }
    let moduleName = moduleFolder.split('/')[1]

    try {
      for (const file of files) {
        let pathArray = file.split('/')
        let type = pathArray[pathArray.length - 1].split('.js')[0]
        if (type !== 'commands' && type !== 'events' && type !== 'config') continue

        let jsObject = require(`./${file}`)
        if (jsObject.reqs) {
          await jsObject.reqs(client, db, moduleName)
        }

        outModule[type] = jsObject[type]
      }

      let commandKeys = Object.keys(outModule.commands)
      let eventKeys = Object.keys(outModule.events)

      commandKeys.forEach(commandName => {
        client.commands.set(commandName, outModule.commands[commandName])
        client.commands.get(commandName).module = moduleName

        let command = outModule.commands[commandName]
        if (command.alias) {
          command.alias.forEach(alias => {
            client.commands.set(alias, outModule.commands[commandName])
          })
        }
      })

      eventKeys.forEach(eventName => {
        if (!eventModules[eventName]) eventModules[eventName] = []
        eventModules[eventName].push({ func: outModule.events[eventName], module: moduleName })
      })

      client.data.modules.push(moduleName)

      console.log(`Loaded module ${moduleName} with ${commandKeys.length} commands and ${eventKeys.length} events`)

      if (outModule.config) client.data.moduleConfig[moduleName] = outModule.config
      else client.data.moduleConfig[moduleName] = {}

      error = false
    } catch (e) {
      if (error) console.log(`Failed to load ${moduleName}\n${e.stack}\n`)
      else console.log(`\nFailed to load ${moduleName}\n${e.stack}\n`)

      error = true
      continue
    }
  }

  loadData(client, dataFiles)

  Object.keys(eventModules).forEach(eventName => {
    client.on(eventName, (...args) => {
      eventModules[eventName].forEach(item => {
        item.func(client, db, item.module, ...args)
      })
    })
  })

  process.on('unhandledRejection', err => { if (err.message !== 'Unknown User') util.log(client, err.stack) })
  client.login(client.data.tokens.discord)
}

function loadData (client, dataFiles) {
  for (const file of dataFiles) {
    if (!file.endsWith('.json')) continue
    const data = require(`./${file}`)

    let pathArray = file.split('/')
    if (pathArray.length > 2) {

    } else {
      let name = pathArray[pathArray.length - 1].split('.json')[0]
      client.data[name] = data
    }
  }
}
