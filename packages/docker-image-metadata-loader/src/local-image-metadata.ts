import { TDockerImageLabels } from "./registry-metadata-client";

export interface TDockerInspectMetadata {
  dockerLabels: TDockerImageLabels
  imageDefinition: TDockerImageReference
}

export type TDockerImageReference={
  dockerImage?: string
  image?: string
  imagetag?: string
}

function extractImageLabels(dockerImageMetadata: any, imageDef: TDockerImageReference, logger, dockerImageName) {
  let ContainerConfig = dockerImageMetadata[0].ContainerConfig;
  let Labels = ContainerConfig.Labels;

  let imageMetadata = {
    imageDefinition: imageDef,
    dockerLabels: Labels
  };
  if (Labels) {
    logger.debug(dockerImageName + " has image metadata with the following Labels", Object.keys(Labels).join(", "));
  }
  return imageMetadata
}

export function dockerImageMetadata(injected: any) {

  const logger = injected("logger");

  const cmd = injected("exec");

  function inspectImage(imageDef:TDockerImageReference, retryCount: number = 0): Promise<TDockerInspectMetadata> {
    return new Promise(function(resolve, reject) {
      let dockerImage = imageDef.dockerImage || imageDef.image + ":" + imageDef.imagetag;
      logger.debug("Extracting labels from image " + dockerImage);
      cmd.extendedExec("docker", [
        "inspect", dockerImage
      ], process.env, function(err) {
        logger.debug("docker inspect error:", err);
        if (err.indexOf("No such") >= 0) {
          if (retryCount > 1) {
            reject("ERROR:" + dockerImage + ": " + err);
          }
          logger.debug("Going to pull ", JSON.stringify(imageDef));

          cmd.exec("docker", ["pull", dockerImage], process.env, function(err) {
              reject("Error pulling " + dockerImage + "\n" + err);
            },
            function(/*stdout*/) {
              logger.info(dockerImage + " pulled, retrying inspect to load metadata");
              inspectImage(imageDef, 2).then(function(result) {
                resolve(result);
              }).catch(function(e) {
                reject(e);
              });
            });
        } else {
          reject("Error inspecting " + dockerImage + ":\n" + err);
        }
      }, function(stdout) {

        let dockerImageMetadata: any
        try{
          dockerImageMetadata = JSON.parse(stdout)
        } catch(e){
          return reject('Error parsing docker metadata')
        }

        try {

          let imageMetadata = extractImageLabels(dockerImageMetadata, imageDef, logger, dockerImage)
          resolve(imageMetadata);
        } catch (e) {
          reject("Error processing metadata retrieved from docker inspect of image " + dockerImage + ":\n" + e + "\nMetadata document:\n" + stdout);
        }
      });

    });
  }

  function inspectImageLabels(imageDef):Promise<TDockerImageLabels>{
    return inspectImage(imageDef).then((imageMetadata)=>{
      return imageMetadata.dockerLabels as TDockerImageLabels
    })
  }

  return {
    inspectImage,
    inspectImageLabels
  };
}

