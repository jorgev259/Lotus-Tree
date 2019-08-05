(async () => {
  // Powered by LotusTree
  let fs = require('fs')
  if (!fs.existsSync('./package.json')) {
    console.log('package.json not found. Adding default from package_basic.json. Use \'npm install to install dependencies\'')
    fs.copyFileSync('package_basic.json', 'package.json')
    process.exit(0)
  }
  if (!fs.existsSync('./node_modules')) {
    console.log('node_modules not found. Use \'npm install to create it\'')
    process.exit(0)
  }

  const gitModule = require('git-promise')

  fs = require('fs-extra')
  const glob = require('glob')

  await fs.remove('./pnpm-lock.yaml')
  let modulesObjectList = require('./data/modules.json')
  const startBot = require('./bot.js')

  let remoteLotus = (await gitModule('ls-remote')).split('\n').filter(e => !e.startsWith('From'))[0].split('\t')[0]
  let localLotus = (await gitModule('rev-parse HEAD')).split('\n')[0]

  if (remoteLotus !== localLotus) {
    console.log(`Updating LotusTree`)
    try {
      await gitModule('git pull')
    } catch (err) {
      console.log(err.stdout)
      console.log('LotusTree update failed. Use \'git pull\' for more detailed information')
      process.exit(0)
    }
    console.log(`Updated LotusTree. Restart the app.`)
    process.exit(0)
  }

  console.log(`LotusTree is up to date.`)

  fs.removeSync('modules_old')
  fs.removeSync('package.json')
  fs.copySync('package_basic.json', 'package.json')
  fs.removeSync('./modules')
  fs.mkdirSync('./modules')
  fs.removeSync('./modules_new')
  fs.mkdirSync('./modules_new')

  await Promise.all(modulesObjectList.map(moduleObject => {
    return new Promise(async (resolve, reject) => {
      switch (moduleObject.type) {
        case 'local':
          let files = glob.sync(`${moduleObject.path}**`, { nodir: true })
            .map(e => { return { original: e, path: e.replace(moduleObject.path, '') } })
            .filter(e => !e.path.startsWith('node_modules') && (!moduleObject.modules || moduleObject.modules.includes(e.path.split('/')[1])))

          let promises = []

          files.forEach(file => {
            if (file.path.endsWith('package.json')) {
              let deps = JSON.parse(fs.readFileSync(moduleObject.path + file.path))
              Object.keys(deps.dependencies).forEach(key => {
                if (!packageJSON.dependencies[key]) packageJSON.dependencies[key] = deps.dependencies[key]
              })
            } else if (file.path.endsWith('.json')) {
              promises.push(fs.copySync(file.original, file.path.replace('modules/', 'data/')))
            } else {
              promises.push(fs.copySync(file.original, file.path.replace('modules/', 'modules_new/')))
            }
          })

          resolve()

          break

        case 'git':
          if (!(await fs.pathExists(`./repos/${moduleObject.name}/.git`))) {
            await git(`clone ${moduleObject.url} ${moduleObject.name}`)
          } else {
            let remote = (await git('ls-remote', moduleObject.name)).split('\n').filter(e => !e.startsWith('From'))[0].split('\t')[0]
            let local = (await git('rev-parse HEAD', moduleObject.name)).split('\n')[0]

            if (remote !== local) {
              console.log(`Updating repository ${moduleObject.name}`)
              await git('git pull', moduleObject.name)
              console.log(`Updated repository ${moduleObject.name}`)
            } else {
              console.log(`${moduleObject.name} is up to date.`)
            }
          }

          let promises2 = []
          let fileList = glob.sync(`repos/${moduleObject.name}/**`, { nodir: true })
            .filter(e => !moduleObject.modules || moduleObject.modules.includes(e.split('/')[3]))

          fileList.forEach(file => {
            if (file.endsWith('dependencies.json')) {
              let moduleName = file.split(`repos/${moduleObject.name}/modules/`)[1].split('/')[0]
              promises2.push(fs.copySync(file, `data/${moduleName}_dependencies.json`))
            } else if (file.endsWith('.json')) {
              promises2.push(fs.copySync(file, file.replace(`repos/${moduleObject.name}/modules/`, 'data/')))
            } else {
              promises2.push(fs.copySync(file, file.replace(`repos/${moduleObject.name}/modules/`, 'modules_new/')))
            }
          })
          resolve()

          break
      }
    })
  }))

  fs.copySync('modules_new', 'modules')
  fs.removeSync('modules_new')
  fs.copySync('modules_basic', 'modules')
  let packageJSON = require('./package.json')

  let fileList = glob.sync(`data/**_dependencies.json`, { nodir: true })
  let change = false
  fileList.forEach(file => {
    let deps = require(`./${file}`)
    Object.keys(deps).forEach(depKey => {
      if (!packageJSON.dependencies[depKey] || packageJSON.dependencies[depKey] !== deps[depKey]) {
        change = true
        packageJSON.dependencies[depKey] = deps[depKey]
      }
    })
  })

  if (change) {
    fs.removeSync('package.json')
    fs.outputFileSync('package.json', JSON.stringify(packageJSON, null, 4))
    console.log(`Dependencies updated. Run "npm i" to install them`)
    process.exit(0)
  }

  startBot()

  function git (command, repo = '') {
    return new Promise((resolve, reject) => {
      gitModule(command, { cwd: `repos/${repo}` }).then(res => {
        resolve(res)
      }).fail(err => {
        console.log(err)
        reject(err)
      })
    })
  }
})()
