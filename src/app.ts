import { Sequelize } from 'sequelize'
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'

import { loadModule } from './loadPackage.ts'
import type {
  LocalConfig,
  Package,
  Config,
  LotusConfig,
  EventFunction,
  Globals
} from './index.ts'

import lotusConfig from './config/lotus.json' with { type: 'json' }

const {
  sequelize: sequelizeConfig,
  discord: discordConfig,
  packages: packageList
} = lotusConfig as LotusConfig
const sequelize = new Sequelize(sequelizeConfig)

const events = new Map<string, EventFunction[]>()
const commands = new Map()
const modules = new Map()

const intents = new Set<GatewayIntentBits>()
const partials = new Set<Partials>()

const defaultConfig: Config = { guild: {}, global: {} }
const config = {}
const localConfig = {} as LocalConfig

const packages = (
  await Promise.all(packageList.map((p) => loadModule(p, sequelize)))
).filter((p: Package | null) => p !== null) as Package[]

packages.forEach((pkg) => {
  const {
    name,
    intents: packageIntents,
    partials: packagePartials,
    events: packageEvents,
    commands: packageCommands,
    config,
    localConfig: pkgLocalConfig
  } = pkg

  const commandNames = []
  localConfig[name] = {}

  packageIntents?.forEach((intent) => intents.add(intent))
  packagePartials?.forEach((partial) => partials.add(partial))

  if (packageEvents) {
    for (const [name, fn] of Object.entries(packageEvents)) {
      if (!events.has(name)) events.set(name, [fn])
      else events.set(name, [...(events.get(name) || []), fn])
    }
  }

  if (packageCommands) {
    for (const [name, command] of Object.entries(packageCommands)) {
      command.name = name
      command.moduleName = pkg.name
      command.enabled = {}
      commands.set(name, command)
      commandNames.push(name)
    }
  }

  if (config?.global) {
    for (const [name, value] of Object.entries(config.global || {})) {
      defaultConfig.global[name] = value
    }
  }

  if (config?.guild) {
    for (const [name, value] of Object.entries(config.guild || {})) {
      defaultConfig.guild[name] = value
    }
  }

  if (pkgLocalConfig) {
    for (const [configName, value] of Object.entries(pkgLocalConfig)) {
      localConfig[name][configName] = value
    }
  }

  const module = { name, commandNames, enabled: {} }
  modules.set(name, module)
})

const client = new Client({
  intents: Array.from(intents),
  partials: Array.from(partials)
})

const globals = {
  sequelize,
  client,
  commands,
  defaultConfig,
  config,
  localConfig,
  modules,
  lotusConfig
} as Globals

for (const [eventName, eventList] of events.entries()) {
  client.on(eventName, (...args) =>
    eventList.forEach((item) => {
      try {
        item(globals, ...args)
      } catch (err) {
        console.log(err)
      }
    })
  )
}

client.once(Events.ClientReady, () => {
  console.log(`Discord bot started! Logged in as ${client.user?.tag}`)
})

client.login(discordConfig.token)
