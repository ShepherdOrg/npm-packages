import { expect } from "chai"
import { extractLastFiveChangesText } from "./retrieve-history"

describe("retrieve git history", function() {

  const lastChangesFromSimpleGit = {all:[    {
      "hash": "5081c564c6a39c7224654d35d75992c311c4855a",
      "date": "2019-04-19 10:31:36 +0000",
      "message": "Npm js auth debug",
      "refs": "",
      "body": "Npm js auth debug\n",
      "author_name": "Guðlaugur S. Egilsson",
      "author_email": "gulli@kolibri.is"
    },
      {
        "hash": "58bff0cfee0cd9d0f2a5d15272b54d40c6c8b97c",
        "date": "2019-04-19 10:28:52 +0000",
        "message": "Npm js auth config",
        "refs": "",
        "body": "Npm js auth config\n",
        "author_name": "Guðlaugur S. Egilsson",
        "author_email": "gulli@kolibri.is"
      },
      {
        "hash": "c991ee30dca4d3bec8d492e8bb065939d26d4819",
        "date": "2019-04-19 10:15:14 +0000",
        "message": "Configuring repo",
        "refs": "",
        "body": "Configuring repo\n",
        "author_name": "Guðlaugur S. Egilsson",
        "author_email": "gulli@kolibri.is"
      },
      {
        "hash": "b89b1238d4ccc76e047e80cd9c0364cb7d9d0143",
        "date": "2019-04-19 10:11:09 +0000",
        "message": "Configuring repo",
        "refs": "",
        "body": "Configuring repo\n",
        "author_name": "Guðlaugur S. Egilsson",
        "author_email": "gulli@kolibri.is"
      },
      {
        "hash": "1d2ff3f6f3188a4bef06b9bf7771fba5418e769f",
        "date": "2019-04-19 10:09:17 +0000",
        "message": "Moving published library to separate repo",
        "refs": "",
        "body": "Moving published library to separate repo\n",
        "author_name": "Guðlaugur S. Egilsson",
        "author_email": "gulli@kolibri.is"
      },
      {
        "hash": "2bfc5ac9261a338b610ccfbb6ccecdad31ec067e",
        "date": "2019-04-19 09:45:19 +0000",
        "message": "Initial commit",
        "refs": "",
        "body": "Initial commit",
        "author_name": "Guðlaugur Stefán Egilsson",
        "author_email": "gulli@kolibri.is"
      }
    ]}

  it("extract text for last five commits similar to legacy shell method", () => {
    // const simpleGit = require("simple-git/promise")()

    const expectedText = `2019-04-19 10:31:36 +0000 by Guðlaugur S. Egilsson. --- Npm js auth debug

2019-04-19 10:28:52 +0000 by Guðlaugur S. Egilsson. --- Npm js auth config

2019-04-19 10:15:14 +0000 by Guðlaugur S. Egilsson. --- Configuring repo

2019-04-19 10:11:09 +0000 by Guðlaugur S. Egilsson. --- Configuring repo

2019-04-19 10:09:17 +0000 by Guðlaugur S. Egilsson. --- Moving published library to separate repo

`
     expect(extractLastFiveChangesText(lastChangesFromSimpleGit)).to.equal(expectedText)
  })
})

