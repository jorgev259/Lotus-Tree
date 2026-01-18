import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'
import { type Options, Sequelize } from 'sequelize'

export interface Config {
  guild: Record<string, any>
  global: Record<string, any>
}

export type LocalConfig = Record<string, Record<string, any>>

export type EventFunction = (globals: Globals, ...args: any[]) => void

export interface Package {
  name: string
  intents?: GatewayIntentBits[]
  partials?: Partials[]
  events?: Record<Events, EventFunction>
  commands?: Record<string, any>
  config?: Config
  localConfig?: LocalConfig
  preload?: (sequelize: Sequelize) => Promise<void>
}

export interface LotusConfig {
  sequelize: Options
  discord: {
    token: string
  }
  packages: string[]
}

export interface Globals {
  sequelize: Sequelize
  client: Client<boolean>
  commands: Map<any, any>
  defaultConfig: Config
  config: {}
  localConfig: LocalConfig
  modules: Map<any, any>
  lotusConfig: LotusConfig
}
