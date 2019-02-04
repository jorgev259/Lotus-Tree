
(async () => {
  let fs = require('fs')
  if (!fs.existsSync('./package.json')) {
    console.log('package.json not found. Adding default from package_basic.json')
    fs.copyFileSync('package_basic.json', 'package.json')
  }
  if (!fs.existsSync('./node_modules')) {
    console.log('node_modules not found. Running "npm install"')
    await npmInstallLegacy()
  }

  fs = require('fs-extra')
  const glob = require('glob')
  const gitModule = require('git-promise')
  const { Client, Collection } = require('discord.js')
  const execa = require('execa')
  const client = new Client()
  client.commands = new Collection()
  client.data = {}
  let firstData = glob.sync(`data/*`)

  const Sqlite = require('better-sqlite3')
  let db = new Sqlite('data/database.db')

  var util = require('./utilities.js')

  loadData(client, firstData)
  checkModules()

  async function checkModules () {
    let modules = require('./data/modules.json')
    fs.removeSync('modules_old')
    fs.removeSync('package.json')
    fs.copySync('package_basic.json', 'package.json')
    fs.removeSync('./modules_new')
    fs.mkdirSync('./modules_new')

    await Promise.all(modules.map(module => {
      return new Promise(async (resolve, reject) => {
        let packageJSON = require('./package.json')
        switch (module.type) {
          case 'local':
            let files = glob.sync(`${module.path}**`, { nodir: true }).map(e => { return { original: e, path: e.replace(module.path, '') } }).filter(e => !e.path.startsWith('node_modules'))
            let promises = []

            files.forEach(file => {
              console.log(file)
              if (file.path.endsWith('package.json')) {
                let deps = JSON.parse(fs.readFileSync(module.path + file.path))
                Object.keys(deps.dependencies).forEach(key => {
                  if (!packageJSON.dependencies[key]) packageJSON.dependencies[key] = deps.dependencies[key]
                })
              } else if (file.path.endsWith('.json')) {
                promises.push(fs.copySync(file.original, file.path.replace('modules/', 'data/')))
              } else {
                promises.push(fs.copySync(file.original, file.path.replace('modules/', 'modules_new/')))
              }
            })

            Promise.all(promises).then(() => {
              console.log('Updating package.json')
              fs.outputFileSync('package.json', JSON.stringify(packageJSON, null, 4))

              resolve(packageJSON)
            }).catch(err => {
              console.log(err)
              resolve(err)
            })

            break

          case 'git':
            if (!await fs.pathExists(`./repos/${module.name}/.git`)) {
              await git(`clone ${module.url} ${module.name}`)
            } else {
              await git('fetch', module.name)
              let local = await git('git rev-parse master', module.name)
              let remote = await git('git rev-parse remotes/origin/master', module.name)

              if (local !== remote) {
                console.log(`Updating repository ${module.name}`)
                await git('git pull', module.name)
                console.log(`Updated repository ${module.name}`)
              } else {
                console.log(`${module.name} is up to date.`)
              }
            }

            let promises2 = []
            let fileList = glob.sync(`repos/${module.name}/**`, { nodir: true })

            fileList.forEach(file => {
              if (file.endsWith('package.json')) {
                let deps = require(`./${file}`)
                Object.keys(deps.dependencies).forEach(key => {
                  if (!packageJSON.dependencies[key]) packageJSON.dependencies[key] = deps.dependencies[key]
                })
              } else if (file.endsWith('.json')) {
                promises2.push(fs.copySync(file, file.replace(`repos/${module.name}/modules/`, 'data/')))
              } else {
                promises2.push(fs.copySync(file, file.replace(`repos/${module.name}/modules/`, 'modules_new/')))
              }
            })

            Promise.all(promises2).then(() => {
              console.log('Updating package.json')
              fs.outputFileSync('package.json', JSON.stringify(packageJSON, null, 4))
              resolve(packageJSON)
            }).catch(err => {
              console.log(err)
              resolve(err)
            })

            break
        }
      })
    }))

    fs.copySync('modules_new', 'modules')
    fs.removeSync('modules_new')
    fs.copySync('modules_basic', 'modules')

    await npmInstallLegacy()
    startBot()
  }

  async function startBot () {
    let dataFiles = glob.sync(`data/*`)

    let modules = glob.sync(`modules/*/`)

    client.data = {}
    client.data.moduleNames = []

    let eventModules = {}
    let error = true
    for (const module of modules) {
      let files = glob.sync(`${module}/*`)

      let outModule = { commands: {}, events: {} }
      let moduleName = module.split('/')[1]

      try {
        for (const file of files) {
          let pathArray = file.split('/')
          let type = pathArray[pathArray.length - 1].split('.js')[0]
          if (type !== 'commands' && type !== 'events') continue

          let jsObject = require(`./${file}`)
          if (jsObject.reqs) {
            await jsObject.reqs(client, db)
          }

          outModule[type] = jsObject[type]
        }

        let commandKeys = Object.keys(outModule.commands)
        let eventKeys = Object.keys(outModule.events)

        commandKeys.forEach(commandName => {
          client.commands.set(commandName, outModule.commands[commandName])
          if (moduleName !== 'commandHandler') client.commands.get(commandName).module = moduleName

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

        if (moduleName !== 'commandHandler') client.data.moduleNames.push(moduleName)

        console.log(`Loaded module ${moduleName} with ${commandKeys.length} commands and ${eventKeys.length} events`)
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

  function npmInstall () {
    return new Promise((resolve, reject) => {
      execa('npm install').stdout.on('end', function () {
        resolve()
      }).pipe(process.stdout)
    })
  }

  function npmInstallLegacy () {
    return new Promise((resolve, reject) => {
      var spawn = require('child_process').spawn

      var ls = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['install'])

      ls.stdout.on('data', function (data) {
        console.log(data.toString())
      })

      ls.stderr.on('data', function (data) {
        console.log(data.toString())
      })

      ls.on('exit', function (code) {
        resolve()
      })
    })
  }

  function git (command, repo = '') {
    return new Promise((resolve, reject) => {
      gitModule(command, { cwd: `repos/${repo}` }).then(res => {
        resolve(res)
      }).fail(err => {
        reject(err)
      })
    })
  }
})()
