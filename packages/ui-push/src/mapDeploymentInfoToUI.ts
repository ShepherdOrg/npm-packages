import { isHerdDeployerMetadata, isHerdK8sMetadata, THerdDeployerMetadata, THerdK8sMetadata } from "./temptypes"
import { TDeployerRole, TDeploymentType } from "@shepherdorg/metadata"
import { DeploymentVersion, Deployment } from "@shepherdorg/ui-graphql-client"

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
        throw new Error("Don't know how to map " + deployerInfo.deployerRole + " to deployer role for UI")
    }
  } else if(isHerdK8sMetadata(deployerInfo)){
    return "Install"
  } else {
    throw new Error("Unable to determine deployer role for " + JSON.stringify(deployerInfo))
  }
}

export function mapToUiVersion(deployerInfo: THerdDeployerMetadata | THerdK8sMetadata): DeploymentUIInfo | undefined {
  function mapLinks() {
    if (deployerInfo.hyperlinks) {
      return deployerInfo.hyperlinks.map(link => {
        return { title: link.title, url: link.url }
      })
    } else {
      return []
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
        docker_image: deployerInfo.dockerImageTag || "missing docker image", // TODO Must fix in metadata library
        docker_image_tag: deployerInfo.dockerImageTag || "missing docker image tag",
        env: deployerInfo.deploymentState.env,
        git_branch: deployerInfo.gitBranch,
        git_commit: deployerInfo.gitCommit || "missing",
        git_hash: deployerInfo.gitHash,
        git_url: deployerInfo.gitUrl,
        kubernetes_deployment_files: [],
        last_commits: deployerInfo.lastCommits,
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
