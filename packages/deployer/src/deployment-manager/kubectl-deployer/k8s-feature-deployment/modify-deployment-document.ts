import { TBranchModificationParams } from "./create-name-change-index"

const JSYAML = require("js-yaml")
const YAMLload = require("./multipart-yaml-load")
const { indexNameReferenceChange } = require("./create-name-change-index")

// const path = require('path');

export function modifyDeploymentDocument(fileContents, branchModificationParams:TBranchModificationParams) {


  let cleanedName = branchModificationParams.branchName?.replace(/\//g, "-").toLowerCase()

  if (!Boolean(cleanedName)) {
    throw new Error("Must provide a feature name for document modifications")
  }

  let needToIndexChanges = Boolean(!branchModificationParams?.nameChangeIndex)

  function addTimeToLive(deploymentDoc) {
    if (!deploymentDoc.metadata) {
      deploymentDoc.metadata = {}
    }
    if (!deploymentDoc.metadata.labels) {
      deploymentDoc.metadata.labels = {}
    }
    if (!branchModificationParams.ttlHours) {
      throw new Error("ttlHours is a required parameter!")
    }
    deploymentDoc.metadata.labels["ttl-hours"] = `${branchModificationParams.ttlHours}`
  }

  function adjustEnvironment(container) {
    if (container.env && container.env) {
      for (let env of container.env) {
        if (
          env.valueFrom &&
          env.valueFrom.secretKeyRef &&
          env.valueFrom.secretKeyRef.name &&
          branchModificationParams.nameChangeIndex &&
          branchModificationParams.nameChangeIndex["Secret"] &&
          branchModificationParams.nameChangeIndex["Secret"][env.valueFrom.secretKeyRef.name]
        ) {
          env.valueFrom.secretKeyRef.name = branchModificationParams.nameChangeIndex["Secret"][env.valueFrom.secretKeyRef.name]
        }
      }
    }
  }


  function adjustNames(deploymentSection) {
    deploymentSection.name && (deploymentSection.name += "-" + cleanedName)

    if (deploymentSection.metadata) {
      deploymentSection.metadata.name && (deploymentSection.metadata.name += "-" + cleanedName)
      if (deploymentSection.metadata.labels) {
        if (deploymentSection.metadata.labels.app) {
          deploymentSection.metadata.labels.app += "-" + cleanedName
        }
        if (deploymentSection.metadata.labels.name) {
          deploymentSection.metadata.labels.name += "-" + cleanedName
        }
        if (deploymentSection.metadata.labels.origin) {
          deploymentSection.metadata.labels.origin = cleanedName
        }
      }
    }
    if (deploymentSection.spec) {
      if (deploymentSection.spec.containers) {
        for (let container of deploymentSection.spec.containers) {
          adjustNames(container)
          adjustEnvironment(container)
        }
      }
      if (deploymentSection.spec.jobTemplate) {
        adjustNames(deploymentSection.spec.jobTemplate)
      }

      let template = deploymentSection.spec.template
      if (template) {
        adjustNames(deploymentSection.spec.template)

        if (template.spec.volumes) {
          for (let volume of template.spec.volumes) {
            if (
              volume.configMap &&
              volume.configMap.name &&
              branchModificationParams &&
              branchModificationParams.nameChangeIndex &&
              branchModificationParams.nameChangeIndex["ConfigMap"] &&
              branchModificationParams.nameChangeIndex["ConfigMap"][volume.configMap.name]
            ) {
              volume.configMap.name = branchModificationParams.nameChangeIndex["ConfigMap"][volume.configMap.name]
            }
          }
        }
      }
      if (deploymentSection.spec.selector) {
        adjustNames(deploymentSection.spec.selector)
        if (Boolean(deploymentSection.spec.selector.app)) {
          deploymentSection.spec.selector.app += "-" + cleanedName
        }
        if (Boolean(deploymentSection.spec.selector.origin)) {
          deploymentSection.spec.selector.origin = cleanedName
        }
      }

      if (deploymentSection.kind === "HorizontalPodAutoscaler") {
        deploymentSection.spec.minReplicas = 1
        deploymentSection.spec.maxReplicas = 1
        if (deploymentSection.spec.scaleTargetRef && deploymentSection.spec.scaleTargetRef.name) {
          deploymentSection.spec.scaleTargetRef.name += "-" + cleanedName
        }
      }
    }
  }

  function adjustIngressNames(deploymentDoc) {
    if (deploymentDoc.kind && deploymentDoc.kind === "Ingress" && deploymentDoc.spec) {
      if (deploymentDoc.spec.rules && deploymentDoc.spec.rules[0] && deploymentDoc.spec.rules[0].host) {
        deploymentDoc.spec.rules[0].host = `${cleanedName}-${deploymentDoc.spec.rules[0].host}`
        const http = deploymentDoc.spec.rules[0].http
        if (http && http.paths)
          http.paths.forEach(path => {
            if (path && path.backend && path.backend.serviceName) {
              path.backend.serviceName += `-${cleanedName}`
            }
          })
      }
    }
  }

  function setOneReplica(deploymentDoc) {
    if (deploymentDoc.spec && deploymentDoc.spec.replicas) {
      deploymentDoc.spec.replicas = 1
    }
  }

  let yamlFiles = YAMLload(fileContents)

  if (needToIndexChanges) {
    branchModificationParams.nameChangeIndex = {}
    for (let parsedDocument of yamlFiles) {
      indexNameReferenceChange(parsedDocument, branchModificationParams)
    }
  }

  let outfiles = ""
  for (let parsedDocument of yamlFiles) {
    addTimeToLive(parsedDocument)

    adjustNames(parsedDocument)

    setOneReplica(parsedDocument)

    adjustIngressNames(parsedDocument)

    try {
      let yml = JSYAML.safeDump(parsedDocument)
      if (outfiles.length > 0) {
        outfiles += "\n---\n"
      }
      outfiles += yml.trim()
    } catch (err) {
      console.error("Error dumping", parsedDocument)
      throw err
    }
  }
  return outfiles
}

