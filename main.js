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
const path = require('path')
fs = require('fs-extra')
const glob = require('glob')

fs.ensureDirSync('config')
fs.ensureDirSync('repos')
fs.ensureDirSync('lotus/deps')

const notFound = ['lotus/modules.json', 'lotus/tokens.json', 'lotus/config.json'].filter(e => !fs.pathExistsSync(e))
if (notFound.length) {
  notFound.forEach(e => fs.copyFileSync(e.replace('.json', '.example.json'), e))
  console.log('Configuration files inside "lotus" not found. Modify them and restart the app')
  process.exit(0)
}

startInstall()

async function startInstall () {
  const remoteLotus = (await gitModule('ls-remote')).split('\n').filter(e => !e.startsWith('From'))[0].split('\t')[0]
  const localLotus = (await gitModule('rev-parse HEAD')).split('\n')[0]

  if (remoteLotus !== localLotus) {
    console.log('Updating LotusTree')
    try {
      await gitModule('git pull')
    } catch (err) {
      console.log(err.stdout)
      console.log('LotusTree update failed. Use \'git pull\' for more detailed information')
      process.exit(0)
    }
    console.log('Updated LotusTree. Restart the app.')
    process.exit(0)
  }

  console.log('LotusTree is up to date.')

  const repoConfig = require('./lotus/modules.json')
  const repoPromises = repoConfig.map(repo => handleFiles[repo.type](repo))
  await Promise.all(repoPromises)

  const packageJSON = require('./package.json')

  const fileList = glob.sync('lotus/deps/**.json', { nodir: true })
  let change = false
  fileList.forEach(file => {
    const deps = require(`./${file}`)
    Object.keys(deps).forEach(depKey => {
      if (!packageJSON.dependencies[depKey] || packageJSON.dependencies[depKey] < deps[depKey]) {
        change = true
        packageJSON.dependencies[depKey] = deps[depKey]
      }
    })
  })

  if (change) {
    fs.outputFileSync('package.json', JSON.stringify(packageJSON, null, 4))
    console.log('Dependencies updated. Run "npm i" to install them')
    process.exit(0)
  }

  require('./bot.js')()
}

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

const handleFiles = {
  local: repo => {
    return copyConfig(repo)
  },
  git: async repo => {
    const repoExists = await fs.pathExists(`./repos/${repo.name}/.git`)
    if (!repoExists) {
      await git(`clone ${repo.url} ${repo.name}`)
      console.log(`Added repository ${repo.name}`)
    } else {
      const remote = (await git('ls-remote', repo.name)).split('\n').filter(e => !e.startsWith('From'))[0].split('\t')[0]
      const local = (await git('rev-parse HEAD', repo.name)).split('\n')[0]

      if (remote !== local) {
        console.log(`Updating repository ${repo.name}`)
        await git('git pull', repo.name)
        console.log(`Updated repository ${repo.name}`)
      } else {
        console.log(`${repo.name} is up to date`)
      }
    }

    repo.path = path.join('repos', repo.name)
    return copyConfig(repo)
  }
}

function copyConfig (repo) {
  const dependencies = checkRepo(repo, glob.sync(path.join(repo.path, '/**/dependencies.json')))
  const config = checkRepo(repo, glob.sync(path.join(repo.path, '/**/**.json'))).filter(e => !dependencies.includes(e))

  const promises = []
  promises.push(...dependencies.map(e => fs.copy(path.join(repo.path, e), path.join('lotus/deps/', `${e.split(path.sep)[0]}.json`))))
  config.forEach(e => {
    const file = path.join('config', e)
    fs.ensureDirSync(path.dirname(file))
    if (!fs.existsSync(file)) {
      promises.push(fs.copy(path.join(repo.path, e), file))
    }
  })
  return Promise.all(promises)
}

function checkRepo (repo, list) {
  return list.map(e => path.relative(repo.path, e).split(path.sep)).filter(e => repo.modules.includes(e[0])).map(e => e.join(path.sep))
}
