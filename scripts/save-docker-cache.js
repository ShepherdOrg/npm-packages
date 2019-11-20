#!/usr/bin/env node
const packages = require('./utils/get-docker-projects')
const { spawn } = require('child_process')

if (packages.length === 0) {
  console.log('Nothing ot push. exiting')
  process.exit(0)
}

const images = packages.map(x => `${x.dockerImageName}:latest`)

const proc = spawn('docker', ['save', ...images])

proc.stderr.pipe(process.stdout)
proc.stdout.pipe(process.stdout)
