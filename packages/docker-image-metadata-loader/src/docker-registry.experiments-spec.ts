import * as agent from "superagent";
import { expect } from "chai";

const https = require("https");
const fs = require("fs");
const url = require("url");
const _ = require("lodash");


function getUserHome() {
  return process.env[(process.platform === "win32") ? "USERPROFILE" : "HOME"];
}

function loadAuth(registry) {
  let dockerAuthFilePath = getUserHome() + "/.docker/config.json";
  let authJson = fs.readFileSync(dockerAuthFilePath);
  let authDoc = JSON.parse(authJson);
  let auth = authDoc.auths[registry];
  if (auth) {
    return auth.auth;
  } else {
    return undefined;

  }
}

// This file contains experiments with docker registry API

function httpsRequest(url, basicAuth, path, accept, headers, done) {
  console.debug(`Requesting ${url} ${path}`);
  accept = accept || "*";
  path = path || ``;
  let options: any = {
    host: url,
    port: 443,
    path: path,
    method: "GET",
    headers: {}
  };
  if (basicAuth) {
    options.headers.Authorization = `Basic ${basicAuth}`;
  }
  if (accept) {
    options.headers.Accept = accept;
  }
  if (headers) {
    _.extend(options.headers, headers);
  }
  let resbuf = "";
  console.debug("Making request", JSON.stringify(options));
  const req = https.request(options, function(res) {
    console.debug(res.statusCode);
    res.on("data", function(d) {
      resbuf += d;
    });
    res.on("end", function(/*enddata*/) {
      console.debug("END OF REQUEST RESPONSE");
      console.debug(JSON.stringify(res.headers));
      done(resbuf, res);
    });
  });
  req.end();
  req.on("error", function(e) {
    console.error(e);
  });
}

xdescribe("Docker registry API - get manifest - basicauth", function() {

  let REGISTRY_URL = "registry.hub.docker.com";
  let basicAuth = loadAuth("https://" + REGISTRY_URL);

  let IMAGE = "icelandair/shepherd";
  let IMAGE_TAG = "latest";


  beforeEach(function() {

  });

  it("Should call  registry", function(done) {
    // Just checking for a wiring/injection error
    //  done();
    //  return;
    console.debug("Using auth", basicAuth);
    httpsRequest(REGISTRY_URL, basicAuth, `/v2/${IMAGE}/manifests/${IMAGE_TAG}`, "application/vnd.docker.distribution.manifest.v2+json", null, function(resbuf) {
      let manifestobj = JSON.parse(resbuf);


      console.debug("Have response", manifestobj);
      fs.writeFileSync("../response.json", resbuf);
      let configdigest = manifestobj.config.digest;
      console.debug("configdigest", configdigest);

      console.debug("Next request");
      httpsRequest(REGISTRY_URL, basicAuth, `/v2/${IMAGE}/blobs/${configdigest}`, "*", null, function(resbuffer, res) {
        if (res.statusCode === 307) {
          console.debug("Redirect...");
          let redirectHeaders = res.headers;
          let redirectUrl = redirectHeaders.location;
          let parsedUrl = url.parse(redirectUrl, true);
          // let newHeaders = parsedUrl.query;
          let path = parsedUrl.path;
          let host = parsedUrl.host;
          httpsRequest(host, undefined, path, undefined, undefined, function(buffer, response) {
            console.debug("Redirect response", response.statusCode, buffer);

            fs.writeFileSync("./metadata.json", buffer);

            done();
          });

        } else {
          console.error("Dont know how to deal with response code ", res.statusCode, ": Respose body: " + resbuffer);
        }
      });

    });
  });


});

describe("Get docker info from local registry using superagent", function() {

  const PROTOCOL = `http`;
  let REGISTRY_HOST = "localhost:5000";

  this.timeout(60000);

  let getImageManifest = (IMAGE, IMAGE_TAG) => {

    let ApiUrl = `${PROTOCOL}://${REGISTRY_HOST}/v2/${IMAGE}/manifests/${IMAGE_TAG}`;
    return agent.get(ApiUrl).set("Host", REGISTRY_HOST).then((result) => {
      let imageManifest = JSON.parse(result.body);
      // console.debug('Have result', Object.getOwnPropertyNames(imageManifest.history[0].v1Compatibility))

      let layerZero = JSON.parse(imageManifest.history[0].v1Compatibility);
      // console.debug('layerZero', layerZero)

      let labels = layerZero.config.Labels;

      return labels;

      console.debug("Labels", labels);
    }).catch((err) => {
      console.debug("FULL ERRROR", JSON.stringify(err, undefined, 2));
      console.debug("Error status", err.status);
      throw new Error(ApiUrl + " :-> " + err.status);
    });

  };


  let getImageTags = (IMAGE) => {
    let ApiUrl = `${PROTOCOL}://${REGISTRY_HOST}/v2/${IMAGE}/tags/list/?n=10`;
    return agent.get(ApiUrl).set("Host", REGISTRY_HOST).then((result) => {
      expect(result.body.displayName).to.equal(`${IMAGE}`);
      return result.body;
    });
  };

  let IMAGE = "shepherd";
  let IMAGE_TAG = "latest";

  // let basicAuth = loadAuth("https://" + REGISTRY_HOST);


  before(() => {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
  });

  it("Should list all shepherd labelled images", () => {
    let ApiUrl = `${PROTOCOL}://${REGISTRY_HOST}/v2/_catalog/?n=10000`;
    console.debug('Query catalog', ApiUrl)
    return agent.get(ApiUrl).then((result) => {
      console.debug("Have result", result.body);

      const imageTagPromises = result.body.repositories.map((imageName) => {
        return getImageTags(imageName);
      });

      // @ts-ignore
      return Promise.all(imageTagPromises);
    }).then((imagesWithTags) => {
      const imageManifestPromises = imagesWithTags.map((imageWithTag:any) => {
        console.debug("Getting manifest for ", imageWithTag.displayName, imageWithTag.tags[0]);
        return getImageManifest(imageWithTag.displayName, imageWithTag.tags[0]);
      });
      // @ts-ignore
      return Promise.all(imageManifestPromises);

    }).then((imagesWithManifests) => {
//            console.debug('HAVE images with manifests', imagesWithManifests)
      return imagesWithManifests.filter(current => current && current["shepherd.displayName"]);
    }).then((filtered) => {
      console.debug("FILTERED", filtered);
    });
  });


  it("Should list my images", () => {
    let ApiUrl = `${PROTOCOL}://${REGISTRY_HOST}/v2/_catalog/?n=10000`;
    return agent.get(ApiUrl).then((result) => {
      console.debug("Have result", result.body);

      result.body.repositories.map((imageName) => {
        console.debug("IMAGE: ", imageName);
      });

      return result.body;
    });

  });

  it("should get tags", () => {

    let ApiUrl = `${PROTOCOL}://${REGISTRY_HOST}/v2/${IMAGE}/tags/list/?page_size=10`;
    console.debug("ApiUrl", ApiUrl);
    return agent.get(ApiUrl).set("Host", REGISTRY_HOST).then((result) => {
      expect(result.body.displayName).to.equal(`${IMAGE}`);
      return result.body;
    });

  });


  it("should get latest manifest", () => {
    let ApiUrl = `${PROTOCOL}://${REGISTRY_HOST}/v2/${IMAGE}/manifests/${IMAGE_TAG}`;
    return agent.get(ApiUrl).set("Host", REGISTRY_HOST).then((result) => {
      let imageManifest = JSON.parse(result.body);
      // console.debug('Have result', Object.getOwnPropertyNames(imageManifest.history[0].v1Compatibility))

      let layerZero = JSON.parse(imageManifest.history[0].v1Compatibility);
      // console.debug('layerZero', layerZero)

      let labels = layerZero.config.Labels;

      console.debug("Labels", labels);
    }).catch((err) => {
      console.debug("FULL ERRROR", JSON.stringify(err, undefined, 2));
      console.debug("Error status", err.status);
      throw new Error(ApiUrl + " :-> " + err.status);
    });

  });

});


xdescribe("Get docker info from hub.docker.com registry using superagent (not working, this is exploratory work)", () => {

  let REGISTRY_HOST = "hub.docker.com";
  let LOGIN_URL = "https://hub.docker.com/v2/users/login/";

  let IMAGE = "gulli/shepherd";
  let IMAGE_TAG = "latest";


  let loginToken = "";
  const UNAME = "gulli";
  const UPASS = "YMmggDCYpxZ3p8nzLLiw";
  before(() => {
    const loginStruct = { "username": UNAME, "password": UPASS };
    return agent.post(LOGIN_URL).send(loginStruct).then((result) => {
      loginToken = result.body.token;
      return result.body.token;
    });
  });

  it("Should list my images", () => {
    const ORGNAME = "icelandair";
    let ApiUrl = `https://hub.docker.com/v2/repositories/${ORGNAME}/?page_size=10000`;
    return agent.get(ApiUrl).set("Authorization", "JWT " + loginToken).then((result) => {
      console.debug("Have result", result.body);
      return result.body;
    });

  });

  it("should get tags", () => {

    let ApiUrl = `https://${REGISTRY_HOST}/v2/repositories/${IMAGE}/tags/?page_size=10`;
    console.debug("ApiUrl", ApiUrl);
    return agent.get(ApiUrl).set("Host", REGISTRY_HOST).set("Authorization", "JWT " + loginToken).then((result) => {
      console.debug("Have result", result.body);
      return result.body;
    });

  });


  xit("should get latest manifest (Does not work)", () => {
    let ApiUrl = `https://${REGISTRY_HOST}/v2/repositories/${IMAGE}/manifests/${IMAGE_TAG}`;
    return agent.get(ApiUrl).set("Host", REGISTRY_HOST).then((result) => {
      let imageManifest = JSON.parse(result.body);
      // console.debug('Have result', Object.getOwnPropertyNames(imageManifest.history[0].v1Compatibility))

      let layerZero = JSON.parse(imageManifest.history[0].v1Compatibility);
      // console.debug('layerZero', layerZero)

      let labels = layerZero.config.Labels;

      console.debug("Labels", labels);
    }).catch((err) => {
      console.debug("FULL ERRROR", JSON.stringify(err, undefined, 2));
      console.debug("Error status", err.status);
      throw new Error(ApiUrl + " :-> " + err.status);
    });

  });

});
