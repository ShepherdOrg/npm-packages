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

function outputVersion(){
  PACKAGE_VERSION=$(node -p -e "require(\"${THISDIR}\" + '/../package.json').version")
  echo "shepherd cli v${PACKAGE_VERSION}"
  set +e
  thisgitinfo=$(cd ${THISDIR} && git rev-parse --abbrev-ref HEAD 2> /dev/null)
  set -e

  if [[ ! thisgitinfo = "${TRUNK_BRANCH_NAME}" && ! thisgitinfo = "" ]]; then
    echo "Executing from branch ${thisgitinfo}"
  fi
}

function verifyInstall(){
  set +e
  echo Verifying $(basename ${BASH_SOURCE[0]}) install.
  echo Script located in "${THISDIR}"


  versionistExists=$(command -v versionist)

  echo "versionist: ${versionistExists}"
  if [[ ! -x "${versionistExists}" ]]; then
    echo "versionist not found. @shepherdorg/versionist is a dependency which should be installed."
    exit 1
  fi

  base64encodeExists=$(command -v base64encode)
  echo "base64encode: ${base64encodeExists}"
  if [[ ! -x "${base64encodeExists}" ]]; then
    echo "base64encode not found. Should be on path."
    exit 1
  fi

  addToDeploymentQueueExists=$(command -v add-to-deployment-queue)
  echo "add-to-deployment-queue: $addToDeploymentQueueExists"
  if [[ ! -x "${addToDeploymentQueueExists}" ]]; then
    echo "add-to-deployment-queue not found. Should be on path."
    exit 1
  fi

  echo
  echo "Dependencies are present on path."
  set -e
}

function outputUsage() {
  cat <<_EOF_
Usage (bash):
    OPTION=OPTIONVALUE $(basename $0) <dockerfile> [push] <parameters>

    If push parameter is present, docker push will be performed at end of successful build.

Parameters:
    --force-rebuild          Force rebuild image. Same as setting FORCE_REBUILD to non-empty value.
    --verbose                More verbose output about decisions being made during build.
    --docker-repository      Specify docker organization for image. Alternative to specifying in dockerOrganization field in shepherd.json.


Special files that processed if present in the same directory as the target Dockerfile:
    shepherd.json            Assumed to contain metadata about the deployment.
    package.json             Assumed to contain up-to-date version string for human readable semantic versioning.
    build.sh                 Assumed to be a pre-build script, which is then sourced before invoking docker build.
    kube.yaml                Assumed to be a kubernetes deployment file describing how to deploy the container built.
    deployments/ (dir)       Assumed to contain a collection of kubernetes deployment files if you prefer to split
                             deployments in a more fine-grained manner.

Environment variable options:
    DOCKER_REGISTRY_HOST:    Set if using self-hosted docker registry. Used to construct image URL along with
                             organisation and repository names.

    FORCE_REBUILD:           Set if you wish to force rebuild of the docker image regardless of its status in the docker
                             registry.
    FORCE_PUSH:              Override docker push prevention on dirty git index.
    BRANCH_NAME:             Git branch name.
    GIT_COMMIT:              Git commit hash.
    SEMANTIC_VERSION:        Use to construct version tag. If not provided, will attempt to extract tag from the "FROM"
                             statement in the dockerfile.

    TRUNK_BRANCH_NAME:       Branch that is considered trunk. Default is "master".

	  SHEPHERD_DEPLOYMENT_QUEUE_FILE:    Deployment queue for monorepo build and deployment support.

The following options are obsolete and no longer supported. Use shepherd.json options or program parameters to control organization and repository names instead.

    IMAGE_NAME:              Specify image name. Defaults to directory name containing the dockerfile if not specified.
                             If specified in shepherd.json (recommended), that will override other options.
    DOCKER_REPOSITORY_NAME:  Docker repository name used to tag the docker image. Defaults to the directory name
                             containing the dockerfile if not provided. Same as specifying IMAGE_NAME.

    DOCKER_REPOSITORY_ORG:   Docker repository organization/namespace. If not provided, defaults to no organization / no
                             namespace.


Examples:

$(basename $0) ./Dockerfile
	Build dockerfile in current directory with default settings.

DOCKER_REGISTRY_HOST=myregistry:8888 $(basename $0) ./Dockerfile push
	Build dockerfile in current directory and push to myregistry:8888/currentdirname:latest registry/repository.

Example sources can be found in the integratedtest/testimages in the deployer sources.
_EOF_
}

function ensure-trunk-tag-and-deploy() {
  set +e

  DOCKER_IMAGE_GITHASH_TAG=$1
  DOCKER_IMAGE_BRANCH_HASH_TAG=$2
  if [ "${BRANCH_NAME}" = "${TRUNK_BRANCH_NAME}" ]; then

    PULLRESULT=$(docker pull ${DOCKER_IMAGE_BRANCH_HASH_TAG} 2>&1)
    if [ "$?" = "0" ]; then
      echo "Already have branch tag on image ${DOCKER_IMAGE_BRANCH_HASH_TAG}"
    else
      echo "Missing ${TRUNK_BRANCH_NAME} branch tag from $DOCKER_IMAGE_GITHASH_TAG, tagging"

      if test ${__DRYRUN} -eq 1; then
        echo __DRYRUN set, not tagging and pushing using "${DOCKER_IMAGE_GITHASH_TAG}" "${DOCKER_IMAGE_BRANCH_HASH_TAG}"
      else
        docker tag "${DOCKER_IMAGE_GITHASH_TAG}" "${DOCKER_IMAGE_BRANCH_HASH_TAG}"
        if [  "${__SHEPHERD_PUSH_ARG}" = "push"  ]; then
          docker push "${DOCKER_IMAGE_BRANCH_HASH_TAG}"
        else
          echo "Missing "${DOCKER_IMAGE_BRANCH_HASH_TAG}" in registry, but push not specified. Tag created, but not pushed."
        fi
      fi

      if [[ -e ./deploy.json && -e ${SHEPHERD_DEPLOYMENT_QUEUE_FILE} ]]; then
        echo "New tag on branch.........      Queueing deployment of ${DOCKER_IMAGE_GITHASH_TAG}" on branch "${BRANCH_NAME}"
        add-to-deployment-queue "${SHEPHERD_DEPLOYMENT_QUEUE_FILE}" ./deploy.json "${DOCKER_IMAGE_GITHASH_TAG}" "${BRANCH_NAME}"
      fi

    fi
  fi
  set -e
}

export THISDIR=$(installationDir ${BASH_SOURCE[0]})

. ${THISDIR}/deploy/functions.sh

if [[ "$THISDIR" == *"node_modules"* ]]; then
  BINPATH=$(absolutepath "$THISDIR/../../../.bin")
  if [ -d "${BINPATH}" ]; then
    export PATH=${BINPATH}:${PATH}
  else
    echo "${BINPATH}" is not a directory, do now know where to locate binaries
    exit 255
  fi
else
  BINPATH=$(absolutepath "$THISDIR/../node_modules/.bin")
  if [ -d "${BINPATH}" ]; then
    export PATH=${BINPATH}:${PATH}
  else
    echo "${BINPATH}" is not a directory, do now know where to locate binaries
    exit 255
  fi
fi


if [[ "${1}" == "" ]]; then
  outputUsage
  exit 0
fi

DOCKERFILE=$1

export __DRYRUN=0

while [[ "$#" -gt 0 ]]; do
    case $1 in
        push)           export __SHEPHERD_PUSH_ARG=$1;;
        -dr|--docker-repository) export __DOCKER_REPO="$2"; shift ;;
        --verbose)      export __SHEPHERD_VERBOSE=1;;
        --force-build)  export FORCE_REBUILD="true";;
        --dryrun)       export __DRYRUN=1;;
        --help)         outputUsage; exit 0;;
        --version)      outputVersion; exit 0;;
        --verifyInstall)    verifyInstall; exit 0;;
    esac
    shift
done

[[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Verbose output ON."


export DOCKERDIR=$(dirname $(echo "$(  cd "$(dirname "${DOCKERFILE}")"
  pwd -P
)/$(basename "${DOCKERFILE}")"))

if [[ -e "${DOCKERDIR}/shepherd.json" ]]; then
  export DOCKER_REGISTRY_HOST=$(node -e "console.log(require('${DOCKERDIR}/shepherd.json').dockerRegistry || process.env.DOCKER_REGISTRY_HOST || '')")
  export SHEPHERD_JSON_IMAGE_NAME=$(node -e "console.log(require('${DOCKERDIR}/shepherd.json').imageName || require('${DOCKERDIR}/shepherd.json').dockerRepository || '')")
  SHEPHERD_JSON_ORG_NAME=$(node -e "console.log(require('${DOCKERDIR}/shepherd.json').dockerOrganization || '')")
  if [ ! -z "${SHEPHERD_JSON_ORG_NAME}" ]; then
    export DOCKER_REPOSITORY_ORG="${SHEPHERD_JSON_ORG_NAME}"
  fi
fi

export DOCKER_REGISTRY_HOST_ONLY=${DOCKER_REGISTRY_HOST}

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
  export DOCKER_REPOSITORY_ORG="${DOCKER_REPOSITORY_ORG}/"
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
    [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Using versiontxt version ${SEMANTIC_VERSION}"
  elif [ -e "${DOCKERDIR}/package.json" ]; then
    export SEMANTIC_VERSION=$(node -e 'console.log(require("./package.json").version)')
    [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Using package.json version ${SEMANTIC_VERSION}"
  else
    SEMANTIC_VERSION=$(cat ${DOCKERFILE} | grep '^FROM.*' | sed "s/^.*:\(.*\)/\1/")
    echo "WARNING: Using deprecated versioning method to extract version from Dockerfile. Please use some other means to version your image."

    if [ -e "${DOCKERDIR}/version-postfix.txt" ]; then
      export SEMANTIC_VERSION=${SEMANTIC_VERSION}$(cat ${DOCKERDIR}/version-postfix.txt)
    fi
  fi
fi

DIRHASH=$(cd ${DOCKERDIR} && git ls-files -s . | git hash-object --stdin)
if [ "${DIRHASH}" = "" ]; then
  DIRHASH=NOT_IN_GIT
fi

if [ -z "$BRANCH_NAME" ]; then
  export BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
fi

# echo $(versionist ${DOCKERDIR} --json --docker-registry "${DOCKER_REGISTRY_HOST_ONLY}" --branch-name "${BRANCH_NAME}")
# Versionist emits env variables compatible with this script.
eval "$(versionist ${DOCKERDIR} --bash-export --docker-registry "${DOCKER_REGISTRY_HOST_ONLY}" --branch-name "${BRANCH_NAME}" --docker-organisation "${__DOCKER_REPO}" --semantic-version "${SEMANTIC_VERSION}")"

export OLD_IMAGE_URL=${DOCKER_REGISTRY_HOST}${DOCKER_REPOSITORY_ORG}${DOCKER_REPOSITORY_NAME}
export OLD_DOCKER_IMAGE=${IMAGE_URL}:${SEMANTIC_VERSION}
export OLD_DOCKER_IMAGE_LATEST_TAG=${IMAGE_URL}:latest
export OLD_DOCKER_IMAGE_GITHASH_TAG=${IMAGE_URL}:${DIRHASH}
export OLD_DOCKER_IMAGE_BRANCH_HASH_TAG=${IMAGE_URL}:${BRANCH_NAME}-${DIRHASH}

function compareValues(){
  V1=${!1}
  V2=${!2}
  if [ ! "$V1" = "$V2" ]; then
    echo "WARNING Backwards compatibility broken on a docker tag. New tag ${1} = ${V1}, Was ${V2}"
  fi
}

compareValues 'IMAGE_URL' 'OLD_IMAGE_URL'
compareValues 'DOCKER_IMAGE' 'OLD_DOCKER_IMAGE'
compareValues 'DOCKER_IMAGE_LATEST_TAG' 'OLD_DOCKER_IMAGE_LATEST_TAG'
compareValues 'DOCKER_IMAGE_GITHASH_TAG' 'OLD_DOCKER_IMAGE_GITHASH_TAG'
compareValues 'DOCKER_IMAGE_BRANCH_HASH_TAG' 'OLD_DOCKER_IMAGE_BRANCH_HASH_TAG'

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

pushd . > /dev/null


cd ${DOCKERDIR}

set +eao pipefail
DIFFCHECK=$(git diff --no-ext-diff --quiet --exit-code )
__GIT_DIRTY_INDEX=$?

if [ -z "${FORCE_REBUILD}" ]; then

  set +e
  [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Check if ${DOCKER_IMAGE_GITHASH_TAG} is already published to docker registry."

  PULLRESULT=$(docker pull ${DOCKER_IMAGE_GITHASH_TAG} 2>&1)
  if [ "$?" = "0" ]; then
   if [  "${__SHEPHERD_PUSH_ARG}" = "push"  ]; then
      if [[ ! "${__GIT_DIRTY_INDEX}" = "0" && -z "${FORCE_PUSH}" ]]; then
        echo "Dirty index, will not push! Git diff follows."
        git diff --no-ext-diff
      else
        ensure-trunk-tag-and-deploy ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_BRANCH_HASH_TAG}
      fi
    fi
    exit 0
  fi
  set -e
  [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Pull result ${PULLRESULT}."
fi

set -eao pipefail

if [ -e "./build.sh" ]; then
  [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Custom pre build script detected, sourcing"
  echo ""
  echo "WARNING: Using build.sh is DEPRECATED, use filename shepherd-prebuild.sh instead."
  echo ""
  . ./build.sh
fi

if [ -e "./shepherd-prebuild.sh" ]; then
  [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Custom pre build script detected, sourcing"
  . ./shepherd-prebuild.sh
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
  [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Packaging kubernetes deployment files with ${DOCKER_IMAGE}"
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
  cp ./shepherd.json ./.build/metadata/userdata.json
else
  [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "NO shepherd.json userdata file, generating displayname"
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
  echo "${DOCKER_IMAGE_GITHASH_TAG} is already built, not building again. Use --force-build to force building of image."

  echo "Ensuring trunk tag and deploy"
  echo ensure-trunk-tag-and-deploy ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_BRANCH_HASH_TAG}
  ensure-trunk-tag-and-deploy ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_BRANCH_HASH_TAG}
  echo "Exit with code 0"
  exit 0

else
  [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Building ${DOCKER_IMAGE_GITHASH_TAG}. Build args ${DOCKER_BUILD_ARGS}"
  docker build -t ${DOCKER_IMAGE_GITHASH_TAG} \
    --build-arg SHEPHERD_METADATA=${SHEPHERD_METADATA} \
    ${DOCKER_BUILD_ARGS} .

  docker tag ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_LATEST_TAG}
  docker tag ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE}
  docker tag ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_BRANCH_HASH_TAG}
  echo "Built & tagged ${DOCKER_IMAGE} / ${DOCKER_IMAGE_BRANCH_HASH_TAG} / ${DOCKER_IMAGE_GITHASH_TAG} / ${DOCKER_IMAGE_LATEST_TAG}"

  if [ ! -z "${LAYERCACHE_TAR}" ]; then
    [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Saving layer cache tar to ${LAYERCACHE_TAR} "
    docker save -o ${LAYERCACHE_TAR} ${DOCKER_IMAGE_LATEST_TAG}
  fi
fi

if test ${__DRYRUN} -eq 1; then
  if [[ -e ./deploy.json && -e ${SHEPHERD_DEPLOYMENT_QUEUE_FILE} ]]; then
    echo "__DRYRUN - Queueing deployment of ${DOCKER_IMAGE_GITHASH_TAG}"
    add-to-deployment-queue ${SHEPHERD_DEPLOYMENT_QUEUE_FILE} ./deploy.json "${DOCKER_IMAGE_GITHASH_TAG}" ${BRANCH_NAME}
  fi
elif [ "${__SHEPHERD_PUSH_ARG}" = "push" ]; then
  if [[ ! "${__GIT_DIRTY_INDEX}" = "0" && -z "${FORCE_PUSH}" ]]; then
    echo "Dirty index, will not push without being forced  with FORCE_PUSH"
		[[ ${__SHEPHERD_VERBOSE} = 1 ]] && git diff --no-ext-diff
  else
    [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Clean index or forcing image push"

    docker push ${DOCKER_IMAGE}
    docker push ${DOCKER_IMAGE_LATEST_TAG}
    docker push ${DOCKER_IMAGE_GITHASH_TAG}
    docker push ${DOCKER_IMAGE_BRANCH_HASH_TAG}
    echo "pushed with tags ${DOCKER_IMAGE} ${DOCKER_IMAGE_GITHASH_TAG} ${DOCKER_IMAGE_LATEST_TAG} ${DOCKER_IMAGE_BRANCH_HASH_TAG}"

    if [[ -e ./deploy.json && -e ${SHEPHERD_DEPLOYMENT_QUEUE_FILE} ]]; then
      echo "Queueing deployment of ${DOCKER_IMAGE_GITHASH_TAG}"
      # NEXT: Change deployment to use docker image metadata instead of local file, might not be built locally !
      add-to-deployment-queue ${SHEPHERD_DEPLOYMENT_QUEUE_FILE} ./deploy.json "${DOCKER_IMAGE_GITHASH_TAG}" ${BRANCH_NAME}
    fi
  fi
else
  echo "Not pushing"
  [[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Not pushing ${DOCKER_IMAGE}"
fi

# TODOLATER Return error if docker image produced is not configured with enough information to deploy
# Create command shepherd-validate-image
# TODOLATER Add SHEPHERD_METADATA arg and label to Dockerfile if missing, rather than throwing error

popd >/dev/null

[[ ${__SHEPHERD_VERBOSE} = 1 ]] && echo "Shepherd build docker complete" $(pwd)

exit 0
