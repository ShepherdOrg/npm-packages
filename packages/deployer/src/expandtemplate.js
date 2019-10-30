const Handlebars = require("handlebars")
const _ = require("lodash")

Handlebars.registerHelper("Base64Encode", (str, param) => {
  let postfix
  if (typeof param !== "object") {
    postfix = param
  } else {
    postfix = ""
  }
  return Buffer(str + postfix).toString("base64")
})

Handlebars.registerHelper("Base64Decode", str => {
  if (!str) {
    return ""
  }

  return Buffer.from(str, "base64").toString()
})

module.exports = function(templateString) {
  var view = Object.assign({}, process.env)

  let template
  try {
    template = Handlebars.compile(templateString, { strict: true })
  } catch (err) {
    throw new Error(
      "Error compiling string as a handlebars template: " +
        err.message +
        ". \nStarting with " +
        templateString.substring(0, 100) +
        "..."
    )
  }

  try {
    return template(view)
  } catch (err) {
    if (err.message.indexOf("not defined") >= 0) {
      const startOfFile = templateString.substring(0, 100) + "..."
      throw new Error(`Handlebars error in file starting with : ${startOfFile}
${err.message}.
Available properties: ${_(view)
        .keys()
        .filter(key => !key.startsWith("npm_"))
        .join(", ")}`)
    } else {
      throw err
    }
  }
}
