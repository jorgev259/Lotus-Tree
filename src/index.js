import { Sequelize } from 'sequelize'
import { Client, Intents } from 'discord.js'
import configFile, { sequelize as seqConfig, discord as discordConfig, packages } from './config/lotus.json'

const sequelize = new Sequelize(seqConfig)

const commands = new Map()
const modules = new Map()
const intentsSet = new Set()
const partialsSet = new Set()

const defaultConfig = { guild: {}, global: {} }
const config = {}

const eventModules = {}

async function start () {
  await Promise.all(packages.map(async pPath => {
    const packageObj = await import(pPath)
    const { name: pName, preload, intents = [], partials = [] } = packageObj
    try {
      const module = { name: pName, commandNames: [], enabled: {} }
      let commandSize = 0
      let eventSize = 0

      if (preload) await preload(sequelize)

      for (const [name, fn] of Object.entries(packageObj.events || {})) {
        if (!eventModules[name]) eventModules[name] = [fn]
        else eventModules[name].push(fn)

        eventSize++
      }

      for (const [name, command] of Object.entries(packageObj.commands || {})) {
        command.moduleName = pName
        command.name = name
        command.enabled = {}
        commands.set(name, command)
        module.commandNames.push(name)
        commandSize++
      }

      if (packageObj.config) {
        for (const [name, value] of Object.entries(packageObj.config.global || {})) {
          defaultConfig.global[name] = value
        }

        for (const [name, value] of Object.entries(packageObj.config.guild || {})) {
          defaultConfig.guild[name] = value
        }
      }

      modules.set(pName, module)

      const loadedText = commandSize > 0 && eventSize > 0
        ? ` with ${commandSize} commands and ${eventSize} events`
        : (commandSize > 0
            ? ` with ${commandSize} commands`
            : (
                eventSize > 0
                  ? ` with ${eventSize} events`
                  : ''
              ))

      console.log(`Loaded "${pName}"${loadedText}`)

      intents.forEach(i => intentsSet.add(i))
      partials.forEach(p => partialsSet.add(p))
    } catch (err) {
      console.log(`Failed to load ${pName} with error: ${err}`)
    }
  }))

  const client = new Client({ intents: Array.from(intentsSet).map(i => Intents.FLAGS[i]), partials: Array.from(partialsSet) })
  const globals = { sequelize, client, commands, defaultConfig, config, modules, configFile }

  for (const [eventName, events] of Object.entries(eventModules)) {
    client.on(eventName, (...args) =>
      events.forEach(item => item(globals, ...args))
    )
  }

  client.once('ready', () => {
    console.log('Discord bot started!')
  })

  client.login(discordConfig.token)
}

start()
