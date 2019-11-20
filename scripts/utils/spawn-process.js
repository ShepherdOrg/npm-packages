const Future = require('fluture')
const chalk = require('chalk').default
const { spawn } = require('child_process')

let currentIdx = 0
const colors = [
  chalk.green,
  chalk.cyan,
  chalk.yellow,
  chalk.magenta,
  chalk.white,
  chalk.gray,
  chalk.blue,
  chalk.greenBright,
  chalk.yellowBright,
  chalk.blueBright,
  chalk.magentaBright,
  chalk.cyanBright,
  chalk.whiteBright,
]

const getColor = () => colors[currentIdx++ % colors.length]

const spawnProcess = (name, command, args, spawnOptions = {}) => {
  return Future((reject, resolve) => {
    const proc = spawn(command, args, spawnOptions)

    const color = getColor()

    const prefixName = s => `${color(`${name} |`)} ${s}`
    const prefixError = s => `${chalk.red(`${name} |`)} ${s}`

    proc.stdout.on('data', data => {
      console.log(
        data
          .toString()
          .split('\n')
          .map(prefixName)
          .join('\n')
      )
    })

    proc.stderr.on('data', data => {
      console.error(
        data
          .toString()
          .split('\n')
          .map(prefixError)
          .join('\n')
      )
    })

    proc.on('close', code => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(code)
      }
    })
  })
}

module.exports = spawnProcess
