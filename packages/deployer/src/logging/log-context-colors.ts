import * as chalk from "chalk"

const COLORS = [
  chalk.rgb(255, 112, 0), // orange
  chalk.rgb(181, 255, 123), // yellowish-green
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

export interface IProvideLogContextColors {
  nextLogContextColor(): chalk.Chalk
}

export function createLogContextColors() : IProvideLogContextColors{
  let currentIdx = 0

  const nextLogContextColor = () => {
    if(currentIdx > COLORS.length){
      let colorFn = COLORS[currentIdx++ % COLORS.length]
      return colorFn.bgRgb(40, 40, 40)
    }
    return COLORS[currentIdx++ % COLORS.length]
  }

  return {
    nextLogContextColor
  }
}
