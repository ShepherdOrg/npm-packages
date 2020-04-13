import { TBranchModificationParams, TDocumentKindNameChangeMaps } from "./create-name-change-index"

import * as jsYaml from "js-yaml"
import { TK8sHttpPath, TK8sIngressDoc, TK8sPartialContainer, TK8sPartialDescriptor } from "../k8s-document-types"
import * as chalk from "chalk"

const { indexNameReferenceChange } = require("./create-name-change-index")


export function modifyDeploymentDocument(fileContents:string, branchModificationParams: TBranchModificationParams) {
  let cleanedName = branchModificationParams.branchName?.replace(/\//g, "-").toLowerCase()

  if (!Boolean(cleanedName)) {
    throw new Error("Must provide a feature name for document modifications")
  }

  let needToIndexChanges = Boolean(!branchModificationParams?.nameChangeIndex)

  function addTimeToLive(deploymentDoc:TK8sPartialDescriptor) {
    if (!deploymentDoc.metadata) {
      deploymentDoc.metadata = {}
    }
    if (!deploymentDoc.metadata.labels) {
      deploymentDoc.metadata.labels = {}
    }
    if (!branchModificationParams.ttlHours) {
      throw new Error(`${chalk.blueBright('ttlHours')} is a required parameter!`)
    }
    deploymentDoc.metadata.labels["ttl-hours"] = `${branchModificationParams.ttlHours}`
  }

  function adjustEnvironment(container:TK8sPartialContainer) {
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
          env.valueFrom.secretKeyRef.name =
            branchModificationParams.nameChangeIndex["Secret"][env.valueFrom.secretKeyRef.name]
        }
      }
    }
  }

  function adjustNames(deploymentSection: TK8sPartialDescriptor) {
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

      if (deploymentSection.spec.template) {
        let template = deploymentSection.spec.template
        adjustNames(deploymentSection.spec.template)

        if (template.spec.volumes) {
          for (let volume of template.spec.volumes) {
            let volumeConfigMapName: string | undefined = volume?.configMap?.name
            let nameChangeIndex: TDocumentKindNameChangeMaps | undefined = branchModificationParams?.nameChangeIndex
            let configMapNameChangeIndex = nameChangeIndex && nameChangeIndex["ConfigMap"]
            if (
              volumeConfigMapName &&
              branchModificationParams &&
              branchModificationParams.nameChangeIndex &&
              configMapNameChangeIndex &&
              Boolean(configMapNameChangeIndex[volumeConfigMapName])
            ) {
              volume.configMap.name = configMapNameChangeIndex[volumeConfigMapName]
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

  function adjustIngressSettings(deploymentDoc: TK8sIngressDoc) {
    if (deploymentDoc.kind && deploymentDoc.kind === "Ingress" && deploymentDoc.spec) {
      if (
        deploymentDoc.metadata &&
        deploymentDoc.metadata.annotations &&
        deploymentDoc.metadata.annotations["nginx.ingress.kubernetes.io/ssl-redirect"]
      ) {
        deploymentDoc.metadata.annotations["nginx.ingress.kubernetes.io/ssl-redirect"] = "false"
      }
      if (deploymentDoc?.spec?.rules[0]?.host) {
        if (
          deploymentDoc.metadata &&
          deploymentDoc.metadata.annotations &&
          deploymentDoc.metadata.annotations["nginx.ingress.kubernetes.io/rewrite-target"] &&
          deploymentDoc?.spec?.rules[0]?.http?.paths[0]?.path
        ) {
          deploymentDoc.spec.rules[0].http.paths[0].path += `-${cleanedName}`
        } else {
          deploymentDoc.spec.rules[0].host = `${cleanedName}-${deploymentDoc.spec.rules[0].host}`
          const http = deploymentDoc.spec.rules[0].http
          if (http && http.paths) {
            http.paths.forEach((path: TK8sHttpPath) => {
              if (path && path.backend && path.backend.serviceName) {
                path.backend.serviceName += `-${cleanedName}`
              }
            })
          }
        }
      }
    }
  }

  function setOneReplica(deploymentDoc: TK8sPartialDescriptor) {
    if (deploymentDoc.spec && deploymentDoc.spec.replicas) {
      deploymentDoc.spec.replicas = 1
    }
  }

  let yamlFiles = jsYaml.safeLoadAll(fileContents)

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

    adjustIngressSettings(parsedDocument)

    try {
      let yml = jsYaml.safeDump(parsedDocument)
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
