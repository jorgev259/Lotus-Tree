import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type ClientEvents
} from 'discord.js'
import { MikroORM } from '@mikro-orm/mariadb'

import {
  type LocalConfig,
  type Config,
  type EventFunction,
  type ClientGlobals,
  type ReadyCommand
} from './index.ts'
import checkConfig from './util/checkConfig.ts'
import getORMConfig from './mikro-orm.config.ts'
import { loadPackage } from './util/package.ts'

const lotusConfig = checkConfig()

const events = new Map<string, EventFunction[]>()
const commands = new Map()
const modules = new Map()

const intents = new Set<GatewayIntentBits>()
const partials = new Set<Partials>()

const defaultConfig: Config = { guild: {}, global: {} }
const config: Config = { guild: {}, global: {} }
const localConfig = {} as LocalConfig

async function start() {
  const packages = await Promise.all(
    lotusConfig.packages.map((packagePath) => loadPackage(packagePath))
  )

  packages.forEach((pkg) => {
    const {
      name,
      about: pkgAbout,
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
        if (!events.has(name)) events.set(name, [fn as EventFunction])
        else
          events.set(name, [...(events.get(name) || []), fn as EventFunction])
      }
    }

    if (packageCommands) {
      for (const [name, command] of Object.entries(packageCommands)) {
        const readyCommand: ReadyCommand = {
          ...command,
          name,
          moduleName: pkg.name,
          enabled: {}
        }

        commands.set(readyCommand.name, readyCommand)
        commandNames.push(readyCommand.name)
      }
    }

    if (config?.global) {
      for (const [name, value] of Object.entries(config.global || {})) {
        defaultConfig.global![name] = value
      }
    }

    if (config?.guild) {
      for (const [name, value] of Object.entries(config.guild || {})) {
        defaultConfig.guild![name] = value
      }
    }

    if (pkgLocalConfig) {
      for (const [configName, value] of Object.entries(pkgLocalConfig)) {
        // @ts-expect-error Untested feature
        localConfig[name][configName] = value
      }
    }

    const module = { name, commandNames, enabled: {}, about: pkgAbout }
    modules.set(name, module)
  })

  const client = new Client({
    intents: Array.from(intents),
    partials: Array.from(partials)
  })

  const orm = await MikroORM.init(await getORMConfig())
  await orm.migrator.create()
  await orm.migrator.up()

  const globals: ClientGlobals = {
    orm: orm.em,
    client,
    commands,
    defaultConfig,
    config,
    localConfig,
    modules,
    lotusConfig
  }

  for (const [eventName, eventList] of events.entries()) {
    client.on(eventName as keyof ClientEvents, (...args) =>
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

  client.login(lotusConfig.discord.token)
}

start()
