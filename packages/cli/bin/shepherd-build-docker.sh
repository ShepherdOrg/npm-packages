#!/usr/bin/env bash

set -eao pipefail

function installationDir() {
  TARGET_FILE=$1

  cd $(dirname $TARGET_FILE)
  TARGET_FILE=$(basename $TARGET_FILE)

  # Iterate down a (possible) chain of symlinks
  while [ -L "$TARGET_FILE" ]; do
    TARGET_FILE=$(readlink $TARGET_FILE)
    cd $(dirname $TARGET_FILE)
    TARGET_FILE=$(basename $TARGET_FILE)
  done

  PHYS_DIR=$(pwd -P)
  RESULT=$(dirname $PHYS_DIR/$TARGET_FILE)
  echo $RESULT
}

function outputUsage() {
  cat <<_EOF_
Usage (bash):
    OPTION=OPTIONVALUE $(basename $0) <dockerfile> [push]

    If push parameter is present, docker push will be performed at end of successful build.

Special files that processed if present in the same directory as the target Dockerfile:
    shepherd.json            Assumed to contain metadata about the deployment.
    package.json             Assumed to contain up-to-date version string for human readable semantic versioning.
    build.sh                 Assumed to be a pre-build script, which is then sourced before invoking docker build.
    kube.yaml                Assumed to be a kubernetes deployment file describing how to deploy the container built.
    deployments/ (dir)       Assumed to contain a collection of kubernetes deployment files if you prefer to split
                             deployments in a more fine-grained manner.

Environment variable options:
    IMAGE_NAME:              Specify image name. Defaults to directory name containing the dockerfile if not specified.
                             If specified in shepherd.json (recommended), that will override other options.
    DOCKER_REGISTRY_HOST:    Set if using self-hosted docker registry. Will be prepended to docker name along with a /
    DOCKER_REPOSITORY_ORG:   Docker repository organization/namespace. If not provided, defaults to no organization / no
                             namespace.
    DOCKER_REPOSITORY_NAME:  Docker repository name used to tag the docker image. Defaults to the directory name
                             containing the dockerfile if not provided.
    FORCE_REBUILD:           Set if you wish to force rebuild of the docker image regardless of its status in the docker
                             registry.
    FORCE_PUSH:              Override docker push prevention on dirty git index.
    BRANCH_NAME:             Git branch name.
    GIT_COMMIT:              Git commit hash.
    SEMANTIC_VERSION:        Use to construct version tag. If not provided, will attempt to extract tag from the "FROM"
                             statement in the dockerfile.

    TRUNK_BRANCH_NAME:       Branch that is considered trunk. Default is "master".

	  SHEPHERD_DEPLOYMENT_QUEUE_FILE:    Deployment queue for monorepo build and deployment support.

Examples:

$(basename $0) ./Dockerfile
	Build dockerfile in current directory with default settings.

DOCKER_REGISTRY_HOST=myregistry:8888 $(basename $0) ./Dockerfile push
	Build dockerfile in current directory and push to myregistry:8888/currentdirname:latest registry/repository.

Example sources can be found in the integratedtest/testimages in the deployer sources.
_EOF_
}

function ensure-trunk-tag-and-deploy() {
  DOCKER_IMAGE_GITHASH_TAG=$1
  DOCKER_IMAGE_BRANCH_HASH_TAG=$2
  if [ "${BRANCH_NAME}" = "${TRUNK_BRANCH_NAME}" ]; then

    if test $(docker image ls $DOCKER_IMAGE_GITHASH_TAG | grep ${DOCKER_IMAGE_BRANCH_HASH_TAG}); then
      echo "Already have branch tag on image ${DOCKER_IMAGE_BRANCH_HASH_TAG}"
    else

      echo "Missing ${TRUNK_BRANCH_NAME} branch tag from $DOCKER_IMAGE_GITHASH_TAG, tagging and deploying"

      docker tag ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_BRANCH_HASH_TAG}

      if [ "${__SHEPHERD_PUSH_ARG}" = "push" ]; then
        if [[ ! "${__SHEPHERD_DIRTY_INDEX}" == "0" && -z "${FORCE_PUSH}" ]]; then
          echo "Dirty index, will not push!"
        else
          echo docker push ${DOCKER_IMAGE_BRANCH_HASH_TAG}
        fi
      fi

      if [[ -e ./deploy.json && -e ${SHEPHERD_DEPLOYMENT_QUEUE_FILE} ]]; then
        echo "New tag on branch.........      Queueing deployment of ${DOCKER_IMAGE_GITHASH_TAG}" on branch "${BRANCH_NAME}"
        add-to-deployment-queue "${SHEPHERD_DEPLOYMENT_QUEUE_FILE}" ./deploy.json "${DOCKER_IMAGE_BRANCH_HASH_TAG}" "${BRANCH_NAME}"
      fi

    fi
  fi
}

export THISDIR=$(installationDir ${BASH_SOURCE[0]})

. ${THISDIR}/deploy/functions.sh

if [[ "${1}" == "" ]]; then
  outputUsage
  exit 0
fi

if has_param '--help' "$@"; then
  outputUsage
  exit 0
fi

if has_param '--version' "$@"; then
  echo "${THISDIR}"
  PACKAGE_VERSION=$(node -p -e "require(\"${THISDIR}\" + '/../package.json').version")
  echo "cli v${PACKAGE_VERSION}"
  exit 0
fi

if has_param '--dryrun' "$@"; then
  DRYRUN=1
else
  DRYRUN=0
fi

DOCKERFILE=$1
export __SHEPHERD_PUSH_ARG=$2

export DOCKERDIR=$(dirname $(echo "$(  cd "$(dirname "${DOCKERFILE}")"
  pwd -P
)/$(basename "${DOCKERFILE}")"))

if [[ -e "${DOCKERDIR}/shepherd.json" ]]; then
  export DOCKER_REGISTRY_HOST=$(node -e "console.log(require('${DOCKERDIR}/shepherd.json').dockerRegistry || process.env.DOCKER_REGISTRY_HOST || '')")
fi

if [ -z "${DOCKER_REGISTRY_HOST}" ]; then
  # Still empty
  export DOCKER_REGISTRY_HOST=""
else
  export DOCKER_REGISTRY_HOST=${DOCKER_REGISTRY_HOST}/
fi

if [ -z "${TRUNK_BRANCH_NAME}" ]; then
  export TRUNK_BRANCH_NAME="master"
fi

if [ -z "${DOCKER_REPOSITORY_ORG}" ]; then
  export DOCKER_REPOSITORY_ORG=""
else
  echo "DOCKER_REPOSITORY_ORG is set to DOCKER_REPOSITORY_ORG"
  export DOCKER_REPOSITORY_ORG="${DOCKER_REPOSITORY_ORG}/"
fi

if [ -e "${DOCKERDIR}/shepherd.json" ]; then
  SHEPHERD_JSON_IMAGE_NAME=$(node -e "console.log(require('${DOCKERDIR}/shepherd.json').imageName || '')")
fi

if [ -z "${SHEPHERD_JSON_IMAGE_NAME}" ]; then
  DOCKER_REPOSITORY_NAME=${IMAGE_NAME}
else
  DOCKER_REPOSITORY_NAME=${SHEPHERD_JSON_IMAGE_NAME}
fi

if [[ -z "${DOCKER_REPOSITORY_NAME}" ]]; then
  export DOCKER_REPOSITORY_NAME=${DOCKERDIR##*/}
fi

export FILENAME=$(basename ${DOCKERFILE})

if [[ ${DOCKERDIR} == *"node_modules"* ]]; then
  echo "Node modules path detected, ignoring ${DOCKERDIR}"
  exit 0
fi

if [ -e "${DOCKERDIR}/.buildignore" ]; then
  echo "${DOCKERDIR} ignored."
  exit 0
fi

if [ -z "${SEMANTIC_VERSION}" ]; then
  if [ -e "${DOCKERDIR}/version.txt" ]; then
    export SEMANTIC_VERSION=$(cat ${DOCKERDIR}/version.txt)
    echo "Using versiontxt version ${SEMANTIC_VERSION}"
  elif [ -e "${DOCKERDIR}/package.json" ]; then
    export SEMANTIC_VERSION=$(node -e 'console.log(require("./package.json").version)')
    echo "Using package.json version ${SEMANTIC_VERSION}"
  else
    SEMANTIC_VERSION=$(cat ${DOCKERFILE} | grep '^FROM.*' | sed "s/^.*:\(.*\)/\1/")

    if [ -e "${DOCKERDIR}/version-postfix.txt" ]; then
      export SEMANTIC_VERSION=${SEMANTIC_VERSION}$(cat ${DOCKERDIR}/version-postfix.txt)
    fi
  fi
fi

DIRHASH=$(git ls-files -s ${DOCKERDIR} | git hash-object --stdin)
if [ "${DIRHASH}" = "" ]; then
  DIRHASH=NOT_IN_GIT
fi

if [ -z "$BRANCH_NAME" ]; then
  export BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
fi

export IMAGE_URL=${DOCKER_REGISTRY_HOST}${DOCKER_REPOSITORY_ORG}${DOCKER_REPOSITORY_NAME}
export DOCKER_IMAGE=${IMAGE_URL}:${SEMANTIC_VERSION}
export DOCKER_IMAGE_LATEST_TAG=${IMAGE_URL}:latest
export DOCKER_IMAGE_GITHASH_TAG=${IMAGE_URL}:${DIRHASH}
export DOCKER_IMAGE_BRANCH_HASH_TAG=${IMAGE_URL}:${BRANCH_NAME}-${DIRHASH}

if [ -z "${FORCE_REBUILD}" ]; then

  set +e
  echo "Check if ${DOCKER_IMAGE_GITHASH_TAG} is already published to docker registry."
  PULLRESULT=$(docker pull ${DOCKER_IMAGE_GITHASH_TAG} 2>&1)
  if [ "$?" = "0" ]; then

    echo "... is already present in registry."

    ensure-trunk-tag-and-deploy ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_BRANCH_HASH_TAG}

    exit 0
  else
    echo "...image not in registry."
  fi
  set -e
fi

rm -rf ${DOCKERDIR}/.build
mkdir -p ${DOCKERDIR}/.build
mkdir -p ${DOCKERDIR}/.build/metadata

set +eao pipefail
export METADATA_LABEL_COUNT=$(cat ${DOCKERFILE} | grep "SHEPHERD_" | wc -l)
set -eao pipefail
if [ $METADATA_LABEL_COUNT = 0 ]; then
  echo "Missing SHEPHERD_METADATA label from ${DOCKERFILE}. Please append"
  echo ""
  echo "ARG SHEPHERD_METADATA"
  echo "LABEL shepherd.metadata=\${SHEPHERD_METADATA}"
  echo ""
  echo "to ${DOCKERFILE}"
  exit 255
fi

while [ ! -d "${DOCKERDIR}/.build/metadata" ]; do
  sleep 1
done

LASTFIVECOMMITS=$(git log -5 --pretty=format:" %aD by %an. --- %s %n" -- ${DOCKERDIR} >${DOCKERDIR}/.build/gitlog.log && cat ${DOCKERDIR}/.build/gitlog.log)
LAST_COMMITS_B64="$(echo "${LASTFIVECOMMITS}" | base64encode)"

pushd .

cd ${DOCKERDIR}

set +eao pipefail
DIFFCHECK=$(git diff --no-ext-diff --quiet --exit-code >/dev/null 2>&1)
export __SHEPHERD_DIRTY_INDEX=$?
set -eao pipefail

if [ -e "./build.sh" ]; then
  echo "Custom pre build script detected, sourcing"
  . ./build.sh
fi

if [ -z "$GIT_COMMIT" ]; then
  export GIT_COMMIT=$(git rev-parse HEAD)
  export GIT_URL=$(git config --get remote.origin.url)
  export BUILD_DATE=$(date)
fi

cat >./.build/metadata/builddata.json <<_EOF_
{
  "buildDate": "$(date +%Y-%m-%dT%H:%M:%S)+00:00"
, "buildHostName": "${HOSTNAME}"
, "dockerImageUrl":"${DOCKER_IMAGE_GITHASH_TAG}"
, "dockerImageGithash":"${DOCKER_IMAGE_GITHASH_TAG}"
, "gitHash":"${DIRHASH}"
, "gitBranch":"${BRANCH_NAME}"
, "gitUrl":"${GIT_URL}"
, "gitCommit":"${GIT_COMMIT}"
, "lastCommits":"${LAST_COMMITS_B64}"
, "semanticVersion":"${SEMANTIC_VERSION}"
_EOF_

if [[ -f ./kube.yaml ]]; then
  mkdir -p ./.build/deployment/

  cat kube.yaml | sed -e "s|DOCKER_IMAGE|"${DOCKER_IMAGE_GITHASH_TAG}"|" >./.build/deployment/kube.yaml
fi

if [[ -d ./deployment ]]; then
  mkdir -p ./.build/deployment/

  find ./deployment -type f -name "*.yaml" -o -name "*.yml" | xargs -n 1 -I {} bash -c 'cat "$@" | sed -e "s|DOCKER_IMAGE|"${DOCKER_IMAGE_GITHASH_TAG}"|" > ./.build/deployment/$(basename $@)  || exit 255' _ {}

fi

if [[ -d ./.build/deployment/ ]]; then
  echo "Packaging kubernetes deployment files with ${DOCKER_IMAGE}"
  set -e

  KUBECONFIG_B64=$(cd ./.build && tar -b 1 -zcv ./deployment/ 2>/dev/null | base64encode)
fi

if [ ! -z "${KUBECONFIG_B64}" ]; then
  cat >>./.build/metadata/builddata.json <<_EOF_
,"kubeConfigB64":"${KUBECONFIG_B64}"
_EOF_

fi

cat >>./.build/metadata/builddata.json <<_EOF_
}
_EOF_

if [ -e ./shepherd.json ]; then
  echo "Have shepherd.json userdata file"
  cp ./shepherd.json ./.build/metadata/userdata.json
else
  echo "NO shepherd.json userdata file, generating displayname"
  cat >./.build/metadata/userdata.json <<_EOF_
{  "displayName":"${DOCKER_REPOSITORY_ORG}${DOCKER_REPOSITORY_NAME}" }
_EOF_
fi

join-metadata-files ./.build/metadata/userdata.json ./.build/metadata/builddata.json >./.build/metadata/shepherd.json

SHEPHERD_METADATA=$(cd ./.build/metadata && tar -b 1 -zcv shepherd.json 2>/dev/null | base64encode)

set +eao pipefail
INSPECTOUT=$(docker inspect ${DOCKER_IMAGE_GITHASH_TAG} 2>&1)
INSPECTRESULT=$?
set -eao pipefail
if [[ "${INSPECTRESULT}" == "0" && -z "${FORCE_REBUILD}" ]]; then
  echo "${DOCKER_IMAGE_GITHASH_TAG} is already built, not building again."

  ensure-trunk-tag-and-deploy ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_BRANCH_HASH_TAG}
  exit 0

else
  echo "Building ${DOCKER_IMAGE_GITHASH_TAG}. Build args ${DOCKER_BUILD_ARGS}"
  docker build -t ${DOCKER_IMAGE_GITHASH_TAG} \
    --build-arg SHEPHERD_METADATA=${SHEPHERD_METADATA} \
    ${DOCKER_BUILD_ARGS} .

  docker tag ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_LATEST_TAG}
  docker tag ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE}
  docker tag ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_BRANCH_HASH_TAG}
  echo "Built & tagged ${DOCKER_IMAGE} / ${DOCKER_IMAGE_GITHASH_TAG} / ${DOCKER_IMAGE_LATEST_TAG}"

  if [ ! -z "${LAYERCACHE_TAR}" ]; then
    echo "Saving layer cache tar to ${LAYERCACHE_TAR} "
    docker save -o ${LAYERCACHE_TAR} ${DOCKER_IMAGE_LATEST_TAG}
  fi
fi

if test ${DRYRUN} -eq 1; then
  if [[ -e ./deploy.json && -e ${SHEPHERD_DEPLOYMENT_QUEUE_FILE} ]]; then
    echo "DRYRUN - Queueing deployment of ${DOCKER_IMAGE_GITHASH_TAG}"
    add-to-deployment-queue ${SHEPHERD_DEPLOYMENT_QUEUE_FILE} ./deploy.json "${DOCKER_IMAGE_GITHASH_TAG}" ${BRANCH_NAME}
  fi
elif [ "${__SHEPHERD_PUSH_ARG}" = "push" ]; then
  if [[ ! "${__SHEPHERD_DIRTY_INDEX}" == "0" && -z "${FORCE_PUSH}" ]]; then
    echo "Dirty index, will not push!"
  else
    echo "Clean index or forcing image push"

    echo docker push ${DOCKER_IMAGE}
    echo docker push ${DOCKER_IMAGE_LATEST_TAG}
    echo docker push ${DOCKER_IMAGE_GITHASH_TAG}
    echo docker push ${DOCKER_IMAGE_BRANCH_HASH_TAG}
    echo "pushed with tags ${DOCKER_IMAGE} ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_LATEST_TAG} ${DOCKER_IMAGE_BRANCH_HASH_TAG}"

    if [[ -e ./deploy.json && -e ${SHEPHERD_DEPLOYMENT_QUEUE_FILE} ]]; then
      echo "Queueing deployment of ${DOCKER_IMAGE_GITHASH_TAG}"
      # NEXT: Change deployment to use docker image metadata instead of local file, might not be built locally !
      add-to-deployment-queue ${SHEPHERD_DEPLOYMENT_QUEUE_FILE} ./deploy.json "${DOCKER_IMAGE_BRANCH_HASH_TAG}" ${BRANCH_NAME}
    fi
  fi
else
  echo "Not pushing ${DOCKER_IMAGE}"
fi

# TODOLATER Return error if docker image produced is not configured with enough information to deploy
# Create command shepherd-validate-image
# TODOLATER Add SHEPHERD_METADATA arg and label to Dockerfile if missing, rather than throwing error

popd >/dev/null

echo "Build exit" $(pwd)
