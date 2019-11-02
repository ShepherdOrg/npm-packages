function processLine(line, options) {
  let result = ""

  let postfix = ""
  if (!options) {
    throw new Error(
      `options is a required parameter! LINE is ${line}, OPTIONS are ${options}`
    )
  }
  if (options.appendNewline) {
    postfix = "\n"
  }

  let KEYWORDS = {
    Base64Encode: function(str) {
      return Buffer.from(str + postfix).toString("base64")
    },
    Base64Decode: function(str) {
      return Buffer.from(str, "base64").toString()
    },
  }

  function expandVariable(keyword, variable, context) {
    // Expands a variable and applies any of the functions that match :keyword:
    // to that value prior to returning it
    //
    // :keyword: the keyword indicating what to do with :variable:'s value
    // :variable: the variable name that's expected to be in the environment
    // :context: the line from which :variable: was extracted from
    let value = undefined
    if (keyword in KEYWORDS) {
      value = process.env[variable]
      if (value === undefined) {
        throw new Error(variable + " empty or not defined, in line " + context)
      } else {
        return KEYWORDS[keyword](value)
      }
    } else {
      throw new Error("Keyword '" + keyword + "' is not valid in: " + context)
    }
  }

  // process one line to search for any occurrences of ${KEYWORD:VARIABLE}
  let pattern = /\${([a-z0-9_]+):([a-z0-9_]+)}/i
  let matches = line.match(pattern)
  if (matches === null) {
    result = line
    return result
  } else {
    let full_match, keyword, variable_name
    ;[full_match, keyword, variable_name] = matches
    let value = expandVariable(keyword, variable_name, line)

    // If there are only space-characters infront of the variable definition
    // we want to indent the value in the same way that
    let indent = 0
    for (let i = 0; i < line.length; i++) {
      if (line[i] == " ") {
        indent++
      } else {
        break
      }
    }
    // If there are new-line characters in the value that we are injecting, we
    // need to indent all but the first line of the value.
    if (value.includes("\n") && indent > 0) {
      let value_lines = value.split("\n")
      for (let i = 1; i < value_lines.length; i++) {
        value_lines[i] = " ".repeat(indent) + value_lines[i]
      }
      value = value_lines.join("\n")
    }

    result += line.replace(full_match, value)

    // If we have something of the string left(whatever comes after our ${keyword:variable} token
    // we have to process that as well before finishing.
    let tail = line.slice(matches.index + full_match.length, line.length)
    if (tail.length > 0) {
      return result + processLine(tail, options)
    }
    return result
  }
}

module.exports = {
  processLine,
}
