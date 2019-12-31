export function expandEnv(lineString:string) {
  if (lineString === undefined || lineString === null) return lineString

  return lineString.replace(/\${?[\w]+}?/g, function(match:string) {
    let curlySyntax = match.indexOf("{") > 0
    if (curlySyntax && match.indexOf("}") < 0) {
      return match
    }
    let varName = match
      .replace("$", "")
      .replace("{", "")
      .replace("}", "")
    if (process.env[varName] === undefined) {
      throw new Error(
        "Reference to environment variable ${" +
          varName +
          "} could not be resolved: " +
          lineString
      )
    }
    return process.env[varName] as string
  })
}
