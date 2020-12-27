import { isHerdDeployerMetadata, isHerdK8sMetadata, THerdDeployerMetadata, THerdK8sMetadata } from "./temptypes"
import { TDeployerRole, TDeploymentType } from "@shepherdorg/metadata"
import { DeploymentVersion, Deployment } from "@shepherdorg/ui-graphql-client"

import * as yaml from "js-yaml"
import path from "path"


export interface DeploymentUIInfo {
  versionInfo: DeploymentVersion
  deploymentInfo: Deployment
}

function mapDeploymentType(deploymentType: TDeploymentType): string {
  switch (deploymentType) {
    case TDeploymentType.Kubernetes:
      return "Kubernetes"
    case TDeploymentType.Deployer:
      return "Deployer"
  }
}

function mapDeployerRole(deployerInfo: THerdDeployerMetadata | THerdK8sMetadata): string {

  if(isHerdDeployerMetadata(deployerInfo) ){
    switch (deployerInfo.deployerRole) {
      case TDeployerRole.Infrastructure:
        return "Infrastructure"
      case TDeployerRole.Install:
        return "Install"
      case TDeployerRole.Migration:
        return "Migration"
      default:
        return "Install"
    }
  } else if(isHerdK8sMetadata(deployerInfo)){
    return "Install"
  } else {
    throw new Error("Unable to determine deployer role for " + JSON.stringify(deployerInfo))
  }
}

function buildLink(linkInfo: {protocol: string, host: string, path: string, title: string}) {
  return {title: linkInfo.title, url: `${linkInfo.protocol}://${path.join(linkInfo.host,linkInfo.path)}` }
}

export function mapToUiVersion(deployerInfo: THerdDeployerMetadata | THerdK8sMetadata): DeploymentUIInfo | undefined {
  function mapLinks() {
    let ingressLinks: { title: string; url: string }[] = []

    if (isHerdK8sMetadata(deployerInfo)) {
      const foundHttpPaths: any[] = []
      if (deployerInfo.kubeDeploymentFiles) {
        Object.values(deployerInfo.kubeDeploymentFiles).forEach((kubeYamlOrJson) => {
          try{
            let parsedMultiContent = yaml.safeLoadAll(kubeYamlOrJson.content)

            parsedMultiContent.forEach(function(parsedContent) {
              let linkTitle: string = parsedContent.metadata.name
              if (parsedContent && parsedContent.kind && parsedContent.kind.toLowerCase() === "ingress") {
                parsedContent.spec.rules.forEach((specRule)=>{
                  specRule.http && specRule.http.paths && specRule.http.paths.forEach((rulePath)=>{
                    if(rulePath.path){
                      foundHttpPaths.push({protocol: 'http', host: specRule.host, path: rulePath.path, title: linkTitle })
                    }
                  })
                })
                if(parsedContent.spec.tls){
                  parsedContent.spec.tls.forEach((tlsSpec)=>{
                    tlsSpec.hosts.forEach((tlsHost)=>{
                      const matchingHttpPath = foundHttpPaths.find((httpPath)=>httpPath.host === tlsHost)
                      if(matchingHttpPath){
                        foundHttpPaths.push({...matchingHttpPath, protocol: 'https', title: 'Secure ' + linkTitle  })
                      }
                    })
                  })
                }
              }
            })
          }catch(err){
            console.warn("Error parsing deployment files, not generating links for kube ingresses!")
          }
        })
      }
      ingressLinks = foundHttpPaths.map(buildLink)
    }
    if (deployerInfo.hyperlinks) {
      return ingressLinks.concat(deployerInfo.hyperlinks.map(link => {
        return { title: link.title, url: link.url }
      }))
    } else {
      return ingressLinks
    }
  }

  if (deployerInfo.deploymentState.modified && deployerInfo.deploymentState.timestamp) {
    let deployedAt = deployerInfo.deploymentState.timestamp.toISOString()
    return {
      versionInfo: {
        build_host_name: deployerInfo.buildHostName || "build host is unknown",
        built_at: deployerInfo.buildDate && deployerInfo.buildDate.toISOString(),
        deployed_at: deployedAt,
        deployment_id: deployerInfo.deploymentState.env + deployerInfo.herdSpec.key,
        docker_image: deployerInfo.dockerImageTag || "missing docker image",
        docker_image_tag: deployerInfo.dockerImageTag || "missing docker image tag",
        env: deployerInfo.deploymentState.env,
        git_branch: deployerInfo.gitBranch,
        git_commit: deployerInfo.gitCommit || "missing",
        git_hash: deployerInfo.gitHash,
        git_url: deployerInfo.gitUrl,
        hyperlinks: mapLinks(),
        kubernetes_deployment_files: [],
        last_commits: deployerInfo.lastCommits,
        time_to_live: deployerInfo.herdSpec.timeToLiveHours,
        version: deployerInfo.semanticVersion,
        id:
          deployerInfo.deploymentState.env +
          deployerInfo.herdSpec.key +
          deployerInfo.deploymentState.version +
          deployedAt,
      },
      deploymentInfo: {
        id: deployerInfo.deploymentState.env + deployerInfo.herdSpec.key,
        display_name: deployerInfo.herdSpec.description || deployerInfo.displayName,
        description: deployerInfo.herdSpec.description,
        deployment_type: mapDeploymentType(deployerInfo.deploymentType),
        deployer_role: mapDeployerRole(deployerInfo),
        db_migration_image: deployerInfo.migrationImage,
        hyperlinks: mapLinks(),
        herd_key: deployerInfo.herdSpec.key,
        last_deployment_timestamp: deployedAt,
        last_deployment_version: deployerInfo.semanticVersion,
        env: deployerInfo.deploymentState.env,
      },
    }
  } else {
    return undefined;
  }
}
