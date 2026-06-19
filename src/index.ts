import type {
  Options as MikroORMOptions,
  EntityManager,
  EntitySchema
} from '@mikro-orm/mariadb'
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'
import type {
  APIEmbedField,
  ClientEvents,
  Message,
  OmitPartialGroupDMChannel
} from 'discord.js'
import {
  Array,
  InstanceOf,
  Object,
  String,
  Optional,
  type Runtype,
  type Static
} from 'runtypes'

export type Config = Record<string, Record<string, string>>
export type LocalConfig = Record<string, Record<string, string>>

export type EventFunction<E extends keyof ClientEvents = keyof ClientEvents> = (
  globals: ClientGlobals,
  ...args: ClientEvents[E]
) => void
export type LotusEvents = Partial<{
  [E in keyof ClientEvents]: (
    globals: ClientGlobals,
    ...args: ClientEvents[E]
  ) => void
}>

export interface Package {
  name: string
  about?: APIEmbedField
  intents?: GatewayIntentBits[]
  partials?: Partials[]
  events?: LotusEvents
  commands?: Record<string, Command>
  config?: Config
  localConfig?: LocalConfig
  preload?: (orm: EntityManager) => Promise<void>
  entities?: EntitySchema[]
}

export interface PackageModule {
  name: string
  commandNames: string[]
  enabled: Record<string, boolean>
  about?: APIEmbedField
}

export const LotusConfigCheck = Object({
  ormConfig: InstanceOf(globalThis.Object) as unknown as Runtype<
    Partial<MikroORMOptions>
  >,
  discord: Object({ token: String }),
  ownerIds: Array(String),
  packages: Array(String),
  permissions: Optional(Array(String))
})

export type LotusConfig = Static<typeof LotusConfigCheck>

export interface ClientGlobals {
  orm: EntityManager
  client: Client<boolean>
  commands: Map<string, ReadyCommand>
  defaultConfig: Config
  config: Config
  localConfig: LocalConfig
  modules: Map<string, PackageModule>
  lotusConfig: LotusConfig
}

export interface CommandGlobals extends ClientGlobals {
  param: string[]
}

export interface Command {
  usage?: string
  desc?: string
  example?: string
  ownerOnly?: boolean
  execute: (
    globals: CommandGlobals,
    ...args: ClientEvents[Events.MessageCreate]
  ) => Promise<unknown>
}

export interface ReadyCommand extends Command {
  name: string
  moduleName: string
  enabled: Record<string, boolean>
}

export type CommandGroup = Record<string, Command>
export type GuildMessage = OmitPartialGroupDMChannel<Message<boolean>>
