import { GatewayIntentBits } from 'discord.js'

import commands from './commands.ts'
import events from './events.ts'
import models from './models.ts'
import type { Package } from '../../index.ts'

const module: Package = {
  name: 'command-handler',
  config: { guild: { prefix: '>' }, global: {} },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  commands,
  events,
  models
}

export default module
