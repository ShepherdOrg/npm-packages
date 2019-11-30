const https = require("https")
const fs = require("fs")
const url = require("url")

function getUserHome() {
  return process.env[process.platform === "win32" ? "USERPROFILE" : "HOME"]
}

function loadAuth(registry) {
  let dockerAuthFilePath = getUserHome() + "/.docker/config.json"
  let authJson = fs.readFileSync(dockerAuthFilePath)
  let authDoc = JSON.parse(authJson)
  let auth = authDoc.auths[registry]
  if (auth) {
    return auth.auth
  } else {
    return undefined
  }
}

// This file contains experiments with docker registry API

function httpsRequest(url, basicAuth, path, accept, headers, done) {
  // console.debug(`Requesting ${url} ${path}`)
  accept = accept || "*"
  path = path || ``
  let options: any = {
    host: url,
    port: 443,
    path: path,
    method: "GET",
    headers: {},
  }
  if (basicAuth) {
    options.headers.Authorization = `Basic ${basicAuth}`
  }
  if (accept) {
    options.headers.Accept = accept
  }
  if (headers) {
    _.extend(options.headers, headers)
  }
  let resbuf = ""
  console.debug("Making request", JSON.stringify(options))
  const req = https.request(options, function(res) {
    console.debug(res.statusCode)
    res.on("data", function(d) {
      resbuf += d
    })
    res.on("end", function(/*enddata*/) {
      console.debug("END OF REQUEST RESPONSE")
      console.debug(JSON.stringify(res.headers))
      done(resbuf, res)
    })
  })
  req.end()
  req.on("error", function(e) {
    console.error(e)
  })
}

xdescribe("Docker registry API - get manifest - basicauth", function() {
  let REGISTRY_URL = "registry.hub.docker.com"
  let basicAuth = loadAuth("https://" + REGISTRY_URL)

  let IMAGE = "sheepherdorg/shepherd"
  let IMAGE_TAG = "latest"

  beforeEach(function() {})

  it("Should call  registry", function(done) {
    // Just checking for a wiring/injection error
    //  done();
    //  return;
    console.debug("Using auth", basicAuth)
    httpsRequest(
      REGISTRY_URL,
      basicAuth,
      `/v2/${IMAGE}/manifests/${IMAGE_TAG}`,
      "application/vnd.docker.distribution.manifest.v2+json",
      null,
      function(resbuf) {
        let manifestobj = JSON.parse(resbuf)

        console.debug("Have response", manifestobj)
        fs.writeFileSync("../response.json", resbuf)
        let configdigest = manifestobj.config.digest
        console.debug("configdigest", configdigest)

        console.debug("Next request")
        httpsRequest(
          REGISTRY_URL,
          basicAuth,
          `/v2/${IMAGE}/blobs/${configdigest}`,
          "*",
          null,
          function(resbuffer, res) {
            if (res.statusCode === 307) {
              console.debug("Redirect...")
              let redirectHeaders = res.headers
              let redirectUrl = redirectHeaders.location
              let parsedUrl = url.parse(redirectUrl, true)
              // let newHeaders = parsedUrl.query;
              let path = parsedUrl.path
              let host = parsedUrl.host
              httpsRequest(
                host,
                undefined,
                path,
                undefined,
                undefined,
                function(buffer, response) {
                  console.debug(
                    "Redirect response",
                    response.statusCode,
                    buffer
                  )

                  fs.writeFileSync("./metadata.json", buffer)

                  done()
                }
              )
            } else {
              console.error(
                "Dont know how to deal with response code ",
                res.statusCode,
                ": Respose body: " + resbuffer
              )
            }
          }
        )
      }
    )
  })
})

