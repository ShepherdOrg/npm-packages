import * as yaml from "js-yaml"
import { TK8sPartialDescriptor } from "./k8s-document-types"
import { ILog } from "@shepherdorg/logger"

type TK8SClusterPolicy = {
  removePublicServiceIpRestrictions: boolean
  maxReplicasPolicy: number
  clusterPolicyMaxCpuRequest: string | false
  publicServicesPolicyIpRestrictions: string | false
}

let policies: TK8SClusterPolicy = {
  clusterPolicyMaxCpuRequest: false,
  maxReplicasPolicy: 0,
  publicServicesPolicyIpRestrictions: false,
  removePublicServiceIpRestrictions: false,
}

function readPoliciesFromEnv() {
  policies = {
    maxReplicasPolicy:
      (process.env.CLUSTER_POLICY_MAX_REPLICAS && parseInt(process.env.CLUSTER_POLICY_MAX_REPLICAS)) || 0,
    clusterPolicyMaxCpuRequest: process.env.CLUSTER_POLICY_MAX_CPU_REQUEST || false,
    publicServicesPolicyIpRestrictions: process.env.CLUSTER_POLICY_PUBLIC_SERVICES_IP_RESTRICTIONS || "unchanged",
    removePublicServiceIpRestrictions: process.env.CLUSTER_POLICY_PUBLIC_SERVICES_IP_RESTRICTIONS === "remove",
  }
}

function applyServicePolicies(serviceDoc: TK8sPartialDescriptor, logger: ILog) {
  let modified = false
  function applyPublicServicePolicy() {
    if (
      serviceDoc.metadata &&
      serviceDoc.metadata.labels &&
      serviceDoc.metadata.labels.publicService &&
      policies.removePublicServiceIpRestrictions
    ) {
      logger.info("Removing ip restrictions on " + serviceDoc.metadata.name)
      if (serviceDoc.spec && serviceDoc.spec.loadBalancerSourceRanges) {
        modified = true
        delete serviceDoc.spec.loadBalancerSourceRanges
      } else {
        logger.warn(
          "WARNING: Public service defined in " +
            serviceDoc.origin +
            "(" +
            serviceDoc.metadata.name +
            "), but no loadBalancerSourceRanges set. This means that non-production deployments may be publicly accessible."
        )
      }
    }
  }

  applyPublicServicePolicy()
  return modified
}

function applyMaxCpuRequestToContainer(containerSpec: TK8sPartialDescriptor, logger: ILog) {
  if (containerSpec.resources && containerSpec.resources.requests && containerSpec.resources.requests.cpu) {
    logger.info(
      `Changing CPU request ${containerSpec.name} from ${containerSpec.resources.requests.cpu} to ${policies.clusterPolicyMaxCpuRequest}`
    )
    containerSpec.resources.requests.cpu = policies.clusterPolicyMaxCpuRequest || ""
    return true
  }
  return false
}

function applyDeploymentPolicies(deploymentDoc: TK8sPartialDescriptor, logger: ILog) {
  let modified = false

  function applyReplicasPolicy() {
    if (policies.maxReplicasPolicy !== 0) {
      let replicas = deploymentDoc.spec.replicas || 0
      if (deploymentDoc.spec && replicas > policies.maxReplicasPolicy) {
        logger.info(
          `Reducing number of replicas in ${deploymentDoc.metadata.name} from ${replicas} to ${policies.maxReplicasPolicy}`
        )
        modified = true
        deploymentDoc.spec.replicas = policies.maxReplicasPolicy
      }
    }
    if (policies.clusterPolicyMaxCpuRequest) {
      if (
        deploymentDoc.spec &&
        deploymentDoc.spec.template &&
        deploymentDoc.spec.template.spec &&
        deploymentDoc.spec.template.spec.containers
      ) {
        for (let containerspec of deploymentDoc.spec.template.spec.containers) {
          modified = modified || applyMaxCpuRequestToContainer(containerspec, logger)
        }
      }
    }
  }

  applyReplicasPolicy()
  return modified
}

function applyHPAPolicies(deploymentDoc: TK8sPartialDescriptor, logger: ILog) {
  let modified = false
  function applyReplicasPolicy() {
    if (policies.maxReplicasPolicy !== 0) {
      let maxReplicas = deploymentDoc.spec.maxReplicas || 0
      if (deploymentDoc.spec && maxReplicas > policies.maxReplicasPolicy) {
        logger.info(
          `Reducing maxreplicas in HPA ${deploymentDoc.metadata.name} from ${maxReplicas} to ${policies.maxReplicasPolicy}`
        )
        logger.info(
          `Reducing minreplicas in HPA ${deploymentDoc.metadata.name} from ${deploymentDoc.spec.minReplicas} to ${policies.maxReplicasPolicy}`
        )
        deploymentDoc.spec.maxReplicas = policies.maxReplicasPolicy
        deploymentDoc.spec.minReplicas = policies.maxReplicasPolicy
        modified = true
      }
    }
    if (policies.clusterPolicyMaxCpuRequest) {
      if (
        deploymentDoc.spec &&
        deploymentDoc.spec.template &&
        deploymentDoc.spec.template.spec &&
        deploymentDoc.spec.template.spec.containers
      ) {
        for (let containerspec of deploymentDoc.spec.template.spec.containers) {
          applyMaxCpuRequestToContainer(containerspec, logger)
        }
      }
    }
  }

  applyReplicasPolicy()
  return modified
}

function applyPolicies(parsedDoc: TK8sPartialDescriptor, logger: ILog) {
  readPoliciesFromEnv()
  let modified = false
  if (parsedDoc.kind === "Service") {
    modified = modified || applyServicePolicies(parsedDoc, logger)
  }
  if (parsedDoc.kind === "Deployment") {
    modified = modified || applyDeploymentPolicies(parsedDoc, logger)
  }
  if (parsedDoc.kind === "HorizontalPodAutoscaler") {
    modified = modified || applyHPAPolicies(parsedDoc, logger)
  }
  return modified
}

function applyPoliciesToDoc(rawDoc: string, logger: ILog) {
  readPoliciesFromEnv()
  try {
    let files = rawDoc.split("\n---\n")
    let modified = false

    let outfiles = ""
    for (let filec of files) {
      if (filec && filec.trim()) {
        let parsedDoc = yaml.safeLoad(filec) as TK8sPartialDescriptor
        modified = modified || applyPolicies(parsedDoc, logger)
        let yml = yaml.safeDump(parsedDoc)
        if (outfiles.length > 0) {
          outfiles += "\n---\n"
        }
        outfiles += yml.trim()
      }
    }
    if (modified) {
      return outfiles
    } else {
      return rawDoc
    }
  } catch (e) {
    let errorMessage = "There was an error applying cluster policy to deployment document: \n" + e.message || e
    errorMessage += "In document:\n"
    errorMessage += rawDoc
    throw new Error(errorMessage)
  }
}

module.exports = {
  applyPolicies: applyPolicies,
  applyPoliciesToDoc: applyPoliciesToDoc,
}
