#!/usr/bin/env node

import { getGitHistory } from "./retrieve-history"
import * as fs from 'fs'

async function main(){
  let dirName = process.argv[2]
  if(!fs.existsSync(dirName) || !fs.statSync(dirName).isDirectory()){
    throw new Error(`${dirName} is not a directory or does not exist`)
  }
  const lastFiveCommitsText = await getGitHistory(dirName).lastFiveCommits()
  const encodedCommits=  Buffer.from(lastFiveCommitsText).toString("base64")
  return encodedCommits
}

main().then((encodedCommits)=>{
  console.log(encodedCommits)
})
