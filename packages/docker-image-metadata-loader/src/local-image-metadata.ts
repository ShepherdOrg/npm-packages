import { TDockerImageLabels } from "./registry-metadata-client";

export interface TDockerInspectMetadata {
  dockerLabels: TDockerImageLabels
  imageDefinition: TDockerImageReference
}

export type TDockerImageReference={
  dockerImage?: string
  image: string
  imagetag: string
}

export function dockerImageMetadata(injected: any) {

  const logger = injected("logger");

  const cmd = injected("exec");

  function pullAndInspectImage(imageDef:TDockerImageReference, retryCount: number = 0): Promise<TDockerInspectMetadata> {
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
              pullAndInspectImage(imageDef, 2).then(function(result) {
                resolve(result);
              }).catch(function(e) {
                reject(e);
              });
            });
        } else {
          reject("Error inspecting " + dockerImage + ":\n" + err);
        }
      }, function(stdout) {
        try {
          let dockerMetadata = JSON.parse(stdout);
          let ContainerConfig = dockerMetadata[0].ContainerConfig;
          let Labels = ContainerConfig.Labels;

          let imageMetadata = {
            imageDefinition: imageDef,
            dockerLabels: Labels
          };
          if (Labels) {
            logger.debug(dockerImage + " has image metadata with the following Labels", Object.keys(Labels).join(", "));
          }
          resolve(imageMetadata);
        } catch (e) {
          reject("Error processing metadata retrieved from docker inspect of image " + dockerImage + ":\n" + e + "\nMetadata document:\n" + stdout);
        }
      });

    });
  }

  function pullAndInspectImageLabels(imageDef):Promise<TDockerImageLabels>{
    return pullAndInspectImage(imageDef).then((imageMetadata)=>{
      return imageMetadata.dockerLabels as TDockerImageLabels
    })
  }

  return {
    pullAndInspectImage: pullAndInspectImage,
    pullAndInspectImageLabels
  };


}

