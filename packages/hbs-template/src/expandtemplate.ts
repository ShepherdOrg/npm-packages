import * as fs from "fs"

const Handlebars = require("handlebars")

type LineLocation = {
  line: number
  column: number
}

type HandleBarsBlock = {
  start: LineLocation
  end: LineLocation
}

type HandleBarsParams = {
  name: string
  hash: {},
  data: object,
  loc: HandleBarsBlock
}

class TemplateError extends Error{
  constructor(message: string, location: HandleBarsBlock, cause?: TemplateError) {
    super(message)
    this.location = location
    this.cause = cause
  }

  location: HandleBarsBlock
  cause?: TemplateError
}

Handlebars.registerHelper("Base64Encode", (str:string | undefined, param:HandleBarsParams) => {
  let postfix

  if(str === undefined){
    throw new TemplateError(`Variable not set, in line# ${param.loc.start.line}`, param.loc)
  }
  if (typeof param !== "object") {
    postfix = param
  } else {
    postfix = ""
  }
  return Buffer.from(str + postfix).toString("base64")
})


Handlebars.registerHelper("Base64EncodeFile", (fileName:string | undefined, params:HandleBarsParams ) => {
  if(fileName === undefined){
    throw new TemplateError(`Variable pointing to file to base64 encode is not set, in line# ${params.loc.start.line}`, params.loc)
  } else {
    if(!fs.existsSync(fileName)){
      throw new Error(`File to encode not found ${fileName}`)
    }
    let fileBuf = fs.readFileSync(fileName)
    return fileBuf.toString("base64")
  }
})

Handlebars.registerHelper("Base64Decode", (str:string | undefined) => {
  if (!str) {
    return ""
  }

  return Buffer.from(str, "base64").toString()
})

export function expandTemplate(templateString: string, variables: typeof process.env = process.env) {
  let template
  try {
    template = Handlebars.compile(templateString, { strict: true , noEscape: true})
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
    return template(variables)
  } catch (err) {
    if( err instanceof TemplateError){
      const lines = templateString.split('\n')
      const offendingLine = lines[err.location.start.line-1]
      const offendingBlock = offendingLine.slice(err.location.start.column, err.location.end.column)
      throw new TemplateError(`Error expanding template block: ${offendingBlock}. ${err.message}`, err.location, err )
    } else if (err.message.indexOf("not defined") >= 0 || err.message.indexOf("Variable pointing to file") >= 0) {
      const startOfFile = templateString.substring(0, 100) + "..."
      throw new Error(`Handlebars error in file starting with : ${startOfFile}
${err.message}.
Available properties: ${Object.getOwnPropertyNames(variables)
        .filter(key => !key.startsWith("npm_"))
        .join(", ")}`)
    } else {
      throw err
    }
  }
}
