/* New entrypoint for shepherd using a command api instead of discrete executables. Going to support
 *    - deploy
 *    - build
 *    - verify
 *    - version
 *    - registry-login
 *
 *  Commands must accept
 *    - --dryrun
 *    - --verbose
 *    - --help
 *
 * */

import { execCmd } from "../src/exec/exec-cmd"

async function main() {
  console.log(`DEBUG Loading shell env from ${__dirname}../e2etest/testenv.env`)
  execCmd()
}

main().then(() => {
  console.log("done")
})
