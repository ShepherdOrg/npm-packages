import { DefaultLogFields, ListLogLine } from "simple-git/typings/response"

import git from "simple-git/promise"

export function extractLastFiveChangesText(gitLog: {
  all: ReadonlyArray<DefaultLogFields & ListLogLine>;
}) {
  return gitLog.all.slice(0, 5).reduce((textLog, currentLog) => {
    return textLog += `${currentLog.date} by ${currentLog.author_name}. --- ${currentLog.message}

`
  }, "")
}

export function getGitHistory(directory: string){

  const repoGit = git(directory)

  return {
    lastFiveCommits: ()=>{
      return repoGit.log({}).then(extractLastFiveChangesText)
    },
    fullLog: repoGit.log
  }

}
