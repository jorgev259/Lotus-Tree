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

  const axios = require('axios')
  fs = require('fs-extra')
  const glob = require('glob')
  const Octokat = require('octokat')
  const { Client, Collection } = require('discord.js')
  const execa = require('execa')

  const client = new Client()
  client.commands = new Collection()
  client.data = {}
  let firstData = glob.sync(`data/*`)

  loadData(client, firstData)
  const octo = new Octokat(client.data.github)

  const Sqlite = require('better-sqlite3')
  let db = new Sqlite('data/database.db')

  var util = require('./utilities.js')

  async function startBot () {
    let dataFiles = glob.sync(`data/*`)

    let modules = glob.sync(`modules/*/`)

    client.data = {}

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
          client.commands.get(commandName).type = moduleName

          let command = outModule.commands[commandName]
          if (command.alias) {
            command.alias.forEach(alias => {
              client.commands.set(alias, outModule.commands[commandName])
            })
          }
        })

        eventKeys.forEach(eventName => {
          if (!eventModules[eventName]) eventModules[eventName] = []
          eventModules[eventName].push(outModule.events[eventName])
        })

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
        eventModules[eventName].forEach(func => {
          func(client, db, ...args)
        })
      })
    })

    process.on('unhandledRejection', err => { if (err.message !== 'Unknown User') util.log(client, err.stack) })
    client.login(client.data.tokens.discord)
  }

  checkModules()

  function resolveFolderRecursive (repo, path) {
    return new Promise(async (resolve, reject) => {
      let contents = await repo.contents(path).read()
      let items = contents.items.map(item => {
        if (item.type === 'dir') {
          return resolveFolderRecursive(repo, item.path)
        } else {
          return item
        }
      })

      let list = await Promise.all(items)
      let out = []
      list.forEach(item => {
        if (Array.isArray(item)) {
          item.forEach(item2 => {
            out.push(item2)
          })
        } else {
          out.push(item)
        }
      })

      resolve(out)
    })
  }

  function resolveRepo (repo) {
    return new Promise((resolve, reject) => {
      axios.get(`https://api.github.com/repos/${repo.owner.login}/${repo.name}/git/trees/master?recursive=1`).then(async res => {
        let data = res.data
        if (data.truncated) {
          // fallback
        } else {
          fs.removeSync('modules_new')
          let packageJSON = require('./package.json')

          let files = data.tree.filter(file => file.type !== 'tree')

          let blobs = await Promise.all(files.map(file => repo.git.blobs(file.sha).read()))
          let promises = []
          for (let i = 0; i < blobs.length; i++) {
            let file = files[i]
            let binary = blobs[i]
            if (file.path.endsWith('package.json')) {
              let deps = JSON.parse(binary)
              Object.keys(deps.dependencies).forEach(key => {
                if (!packageJSON.dependencies[key]) packageJSON.dependencies[key] = deps.dependencies[key]
              })
            } else if (file.path.endsWith('.json')) {
              promises.push(fs.outputFile(file.path.replace('modules/', 'data/'), binary))
            } else {
              promises.push(fs.outputFile(file.path.replace('modules/', 'modules_new/'), binary))
            }
          }

          Promise.all(promises).then(() => {
            console.log('Updating package.json')
            fs.outputFileSync('package.json', JSON.stringify(packageJSON, null, 4))

            if (fs.existsSync('modules')) {
              console.log('Creating backup folder')
              fs.moveSync('modules', 'modules_old')
            }
            console.log('Moving updated modules')
            fs.moveSync('modules_new', 'modules')
            resolve()
          }).catch(err => {
            console.log(err)
            console.log('Modules update failed. Using backup folder')
            fs.removeSync('modules_new')
            fs.moveSync('modules_old', 'modules')
            reject(err)
          })
        }
      })
    })
  }

  async function checkModules (url) {
    let modules = require('./data/modules.json')
    fs.removeSync('modules_old')
    fs.removeSync('package.json')
    fs.copySync('package_basic.json', 'package.json')

    let promises = modules.map(module => {
      return new Promise((resolve, reject) => {
        octo.repos(module.owner, module.repo).fetch().then(repo => {
          console.log(`Updating ${module.owner}/${module.repo}`)
          resolveRepo(repo).then(() => {
            console.log('Update successfull')
          }).catch(() => {
            console.log('Update failed')
          }).finally(() => {
            console.log('\n')
            resolve()
          })
        })
      })
    })

    await Promise.all(promises)
    fs.copySync('modules_basic', 'modules')

    await npmInstall()
    startBot()
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
})()
