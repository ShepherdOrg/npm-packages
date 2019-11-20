#!/usr/bin/env node
const Future = require('fluture')
const path = require('path')
const os = require('os')
const cpuCount = os.cpus().length
const spawnProcess = require('./utils/spawn-process')
const packages = require('./utils/get-docker-projects')

const baseDirectory = path.resolve(__dirname, '../')
const binDirectory = path.resolve(baseDirectory, './node_modules/.bin')

const max = (a, b) => Math.max(a, b)
const nameLength = packages.map(x => x.dockerImageName.length).reduce(max, 0)

if (packages.length === 0) {
  console.log('Nothing ot build. exiting')
  process.exit(0)
}

Future.parallel(
  cpuCount,
  packages.map(info =>
    spawnProcess(
      info.dockerImageName.padEnd(nameLength, ' '),
      'shepherd-build-docker',
      [path.resolve(info.path, 'Dockerfile')],
      {
        env: {
          ...process.env,
          PATH: `${process.env.PATH}:${binDirectory}`,
          IMAGE_NAME: info.dockerImageName,
          SEMANTIC_VERSION: info.version,
        },
      }
    )
  )
).fork(
  code => {
    process.exit(code)
  },
  () => {
    process.exit(0)
  }
)
