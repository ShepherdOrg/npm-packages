import { DeploymentUIInfo } from "../mapDeploymentInfoToUI"

export function expectedDeploymentUiInfo():Array<DeploymentUIInfo>{
  return [
    {
      "versionInfo": {
        "build_host_name": "build host is unknown",
        "built_at": "2019-10-09T14:57:09.000Z",
        "deployed_at": "2019-10-30T22:16:48.635Z",
        "deployment_id": "UNITTESTtest-image",
        "docker_image": "missing docker image",
        "docker_image_tag": "missing docker image tag",
        "env": "UNITTEST",
        "git_branch": "UNITTEST",
        "git_commit": "missing",
        "git_hash": "e519b5d428aba43ee8e9d3919c94dece9be7c023",
        "git_url": "git@github.com:ShepherdOrg/shepherd.git",
        "kubernetes_deployment_files": [],
        "last_commits": "Wed, 9 Oct 2019 14:40:02 +0000 by Guðlaugur S. Egilsson. --- Adding test docker build using json metadata format Sat, 29 Jun 2019 17:32:44 +0000 by Guðlaugur S. Egilsson. --- Rewrite labels in metadata rather than using or statements. Sat, 4 May 2019 23:06:11 +0000 by Guðlaugur S. Egilsson. --- Support handlebars template expansion in kube deployment files Sat, 20 Apr 2019 08:00:34 +0000 by Guðlaugur S. Egilsson. --- Use published packages from npm-packages monorepo Fri, 19 Apr 2019 12:06:14 +0000 by Guðlaugur S. Egilsson. --- Moving docker-image-metadata-loader to published npm packages.\n",
        "version": "0.0.0",
        "id": "UNITTESTtest-image0.0.02019-10-30T22:16:48.635Z"
      },
      "deploymentInfo": {
        "id": "UNITTESTtest-image",
        "display_name": "Testimage",
        "deployment_type": "Kubernetes",
        "description": undefined,
        "deployer_role": "Install",
        "db_migration_image": "testenvimage-migrations:0.0.0",
        "hyperlinks": [],
        "last_deployment_timestamp": "2019-10-30T22:16:48.635Z",
        "env": "UNITTEST"
      }
    },
    {
      "versionInfo": {
        "build_host_name": "build host is unknown",
        "built_at": "2019-10-09T14:57:09.000Z",
        "deployed_at": "2019-10-30T22:16:48.635Z",
        "deployment_id": "UNITTESTtest-image",
        "docker_image": "missing docker image",
        "docker_image_tag": "missing docker image tag",
        "env": "UNITTEST",
        "git_branch": "UNITTEST",
        "git_commit": "missing",
        "git_hash": "e519b5d428aba43ee8e9d3919c94dece9be7c023",
        "git_url": "git@github.com:ShepherdOrg/shepherd.git",
        "kubernetes_deployment_files": [],
        "last_commits": "Wed, 9 Oct 2019 14:40:02 +0000 by Guðlaugur S. Egilsson. --- Adding test docker build using json metadata format Sat, 29 Jun 2019 17:32:44 +0000 by Guðlaugur S. Egilsson. --- Rewrite labels in metadata rather than using or statements. Sat, 4 May 2019 23:06:11 +0000 by Guðlaugur S. Egilsson. --- Support handlebars template expansion in kube deployment files Sat, 20 Apr 2019 08:00:34 +0000 by Guðlaugur S. Egilsson. --- Use published packages from npm-packages monorepo Fri, 19 Apr 2019 12:06:14 +0000 by Guðlaugur S. Egilsson. --- Moving docker-image-metadata-loader to published npm packages.\n",
        "version": "0.0.0",
        "id": "UNITTESTtest-image0.0.02019-10-30T22:16:48.635Z"
      },
      "deploymentInfo": {
        "id": "UNITTESTtest-image",
        "display_name": "Testimage",
        "deployment_type": "Kubernetes",
        "description": undefined,
        "deployer_role": "Install",
        "db_migration_image": "testenvimage-migrations:0.0.0",
        "hyperlinks": [],
        "last_deployment_timestamp": "2019-10-30T22:16:48.635Z",
        "env": "UNITTEST"
      }
    },
    {
      "versionInfo": {
        "build_host_name": "build host is unknown",
        "built_at": "1970-01-01T00:00:00.000Z",
        "deployed_at": "2019-10-30T22:16:48.635Z",
        "deployment_id": "UNITTESTkube-config - /Users/gulli/src/github.com/shepherd/npm-packages/packages/deployer/src/deployment-manager/testdata/happypath/namespaces",
        "docker_image": "missing docker image",
        "docker_image_tag": "missing docker image tag",
        "env": "UNITTEST",
        "git_branch": "UNITTEST",
        "git_commit": "missing",
        "git_hash": undefined,
        "git_url": undefined,
        "kubernetes_deployment_files": [],
        "last_commits": undefined,
        "version": "0",
        "id": "UNITTESTkube-config - /Users/gulli/src/github.com/shepherd/npm-packages/packages/deployer/src/deployment-manager/testdata/happypath/namespaces0.0.02019-10-30T22:16:48.635Z"
      },
      "deploymentInfo": {
        "id": "UNITTESTkube-config - /Users/gulli/src/github.com/shepherd/npm-packages/packages/deployer/src/deployment-manager/testdata/happypath/namespaces",
        "display_name": "Kubernetes pull secrets, namespaces, common config",
        "description": "Kubernetes pull secrets, namespaces, common config",
        "deployment_type": "Kubernetes",
        "hyperlinks": [],
        "last_deployment_timestamp": "2019-10-30T22:16:48.635Z",
        "env": "UNITTEST",
        "db_migration_image":undefined,
        "deployer_role":undefined,
      }
    }
  ]
}
