#!/usr/bin/env node
const Future = require('fluture')
const os = require('os')
const cpuCount = os.cpus().length
const packages = require('./utils/get-docker-projects')
const spawnProcess = require('./utils/spawn-process')

if (packages.length === 0) {
  console.log('Nothing ot build. exiting')
  process.exit(0)
}

Future.parallel(
  cpuCount,
  packages.map(info =>
    spawnProcess(info.dockerImageName, 'docker', ['push', info.dockerImageName])
  )
).fork(
  code => {
    process.exit(code)
  },
  () => {
    process.exit(0)
  }
)
