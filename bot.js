const { Client, Collection } = require('discord.js')
var merge = require('merge-objects')
const client = new Client({ partials: ['MESSAGE', 'CHANNEL'] })
client.commands = new Collection()
client.data = {}

var argv = require('minimist')(process.argv.slice(2))
const glob = require('glob')
const firstData = glob.sync('data/*')

const Sqlite = require('better-sqlite3')
const db = new Sqlite('data/database.db')

var util = require('./utilities.js')

loadData(client, firstData)

module.exports = async function () {
  const modules = glob.sync('modules/*/')

  client.data = { modules: [], moduleConfig: {} }

  const eventModules = {}
  let error = true
  for (const moduleFolder of modules) {
    const files = glob.sync(`${moduleFolder}/*`)

    const outModule = { commands: {}, events: {} }
    const moduleName = moduleFolder.split('/')[1]

    try {
      for (const file of files) {
        const pathArray = file.split('/')
        const type = pathArray[pathArray.length - 1].split('.js')[0]
        if (type !== 'commands' && type !== 'events') continue

        const jsObject = require(`./${file}`)
        if (jsObject.reqs) {
          await jsObject.reqs(client, db, moduleName)
        }

        if (jsObject.config) client.data.moduleConfig[moduleName] = jsObject.config

        outModule[type] = jsObject[type]
      }

      const commandKeys = outModule.commands ? Object.keys(outModule.commands) : []
      const eventKeys = outModule.events ? Object.keys(outModule.events) : []

      commandKeys.forEach(commandName => {
        client.commands.set(commandName, outModule.commands[commandName])
        client.commands.get(commandName).module = moduleName

        const command = outModule.commands[commandName]
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

      error = false
    } catch (e) {
      if (error) console.log(`Failed to load ${moduleName}\n${e.stack}\n`)
      else console.log(`\nFailed to load ${moduleName}\n${e.stack}\n`)

      error = true
      continue
    }
  }

  loadData(client)

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

  client.login(client.data.lotus.tokens.discord).then(() => console.log('Logged in!'))

  if (argv.d) {
    client.on('debug', function (info) {
      console.log(`debug -> ${info}`)
    })
  }
}

function loadData (client) {
  const dataFiles = glob.sync('data/**', { nodir: true })
  for (const file of dataFiles) {
    if (!file.endsWith('.json')) continue
    const data = require(`./${file}`)

    const pathArray = file.split('/')
    merge(client, getDeep(data, pathArray))
  }
}

function getDeep (data, splitArray) {
  const result = {}
  let name = splitArray.shift()

  if (splitArray.length === 0) {
    name = name.replace('.json', '')
    if (!name.endsWith('.example')) result[name] = data
  } else {
    result[name] = getDeep(data, splitArray)
  }

  return result
}
