import fs from 'fs-extra'
import path from 'path'

import type { Package } from '../index.ts'

export async function loadPackage(packagePath: string) {
  const packageObj = await importPackage(packagePath)
  const { name, localConfig, commands = {}, events = {} } = packageObj

  if (localConfig) {
    const configPath = path.join('./config/', `${name}.json`)
    const configExists = await fs.pathExists(configPath)

    if (!configExists) {
      await fs.writeJson(configPath, localConfig)
      throw new Error(
        `${configPath} has been created. Edit the file then restart the bot`
      )
    } else {
      packageObj.localConfig = await fs.readJSON(configPath)
    }
  }

  const commandSize = Object.values(commands).length
  const eventSize = Object.values(events).length

  const loadedText =
    commandSize > 0 && eventSize > 0
      ? ` with ${commandSize} commands and ${eventSize} events`
      : commandSize > 0
        ? ` with ${commandSize} commands`
        : eventSize > 0
          ? ` with ${eventSize} events`
          : ''

  console.log(`Loaded ${name}${loadedText}`)
  return packageObj
}

export async function importPackage(packagePath: string) {
  const { default: botPackage }: { default: Package } = await import(
    packagePath
  )
  return botPackage
}
