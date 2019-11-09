const fs = require("fs")

const rmDir = function(dirPath, removeSelf) {
  if (removeSelf === undefined) removeSelf = true
  let files
  try {
    files = fs.readdirSync(dirPath)
  } catch (e) {
    return
  }
  if (files.length > 0)
    for (let i = 0; i < files.length; i++) {
      let filePath = dirPath + "/" + files[i]
      if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath)
      else rmDir(filePath)
    }
  if (removeSelf) fs.rmdirSync(dirPath)
}

module.exports = rmDir
