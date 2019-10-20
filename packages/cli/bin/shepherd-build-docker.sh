#!/usr/bin/env bash

set -eao pipefail

function installationDir(){
	TARGET_FILE=$1

	cd `dirname $TARGET_FILE`
	TARGET_FILE=`basename $TARGET_FILE`

	# Iterate down a (possible) chain of symlinks
	while [ -L "$TARGET_FILE" ]
	do
	    TARGET_FILE=`readlink $TARGET_FILE`
	    cd `dirname $TARGET_FILE`
	    TARGET_FILE=`basename $TARGET_FILE`
	done

	PHYS_DIR=`pwd -P`
	RESULT=$(dirname $PHYS_DIR/$TARGET_FILE)
	echo $RESULT
}

function outputUsage(){
	cat << _EOF_
Usage (bash):
	OPTION=OPTIONVALUE $(basename $0) <dockerfile> [push]

	If push parameter is present, docker push will be performed at end of successful build.

Options:
	DOCKER_REGISTRY_HOST:    Set if using self-hosted docker registry. Will be prepended to docker name along with a /
	DOCKER_REPOSITORY_ORG:   Docker repository organization/namespace. If not provided, defaults to no organization / no namespace.
	DOCKER_REPOSITORY_NAME:  Docker repository name used to tag the docker image. Defaults to the directory name containing the dockerfile if not provided.
	FORCE_REBUILD:           Set if you wish to force rebuild of the docker image regardless of its status in the docker registry.
	BRANCH_NAME:             Git branch name
	GIT_COMMIT:              Git commit hash
	SEMANTIC_VERSION:        Use to construct version tag. If not provided, will extract tag from the "FROM" statement in the dockerfile.

Examples:

$(basename $0) ./Dockerfile
	Build dockerfile in current directory with default settings.

DOCKER_REGISTRY_HOST=myregistry:8888 $(basename $0) ./Dockerfile push
	Build dockerfile in current directory and push to myregistry:8888/currentdirname:latest registry/repository.

_EOF_
}

export THISDIR=$(installationDir ${BASH_SOURCE[0]})

. ${THISDIR}/deploy/functions.sh



if [[ "${1}" = "" ]]; then
	outputUsage
	exit 0
fi

if has_param '--help' "$@"; then
	outputUsage
	exit 0
fi

DOCKERFILE=$1
PUSH_ARG=$2

if [ -z "${DOCKER_REGISTRY_HOST}" ]; then
	export DOCKER_REGISTRY_HOST=""
else
	export DOCKER_REGISTRY_HOST=${DOCKER_REGISTRY_HOST}/
fi

if [ -z "${DOCKER_REPOSITORY_ORG}" ]; then
	export DOCKER_REPOSITORY_ORG=""
else
	echo "DOCKER_REPOSITORY_ORG is set to DOCKER_REPOSITORY_ORG"
	export DOCKER_REPOSITORY_ORG="${DOCKER_REPOSITORY_ORG}/"
fi

export DOCKERDIR=$(dirname $(echo "$(cd "$(dirname "${DOCKERFILE}")"; pwd -P)/$(basename "${DOCKERFILE}")"))

if [[ -z "${DOCKER_REPOSITORY_NAME}" ]]; then
	export DOCKER_REPOSITORY_NAME=${DOCKERDIR##*/}
fi

export FILENAME=$(basename ${DOCKERFILE})

if [[ ${DOCKERDIR} == *"node_modules"* ]]; then
    echo "Node modules path detected, ignoring ${DOCKERDIR}"
	exit 0
fi

if [ ! "${FILENAME}" = "Dockerfile" ]; then
	echo "${DOCKERFILE} should be path to Dockerfile"
	exit 255
fi

if [ -e "${DOCKERDIR}/.buildignore" ]; then
	echo  "${DOCKERDIR} ignored."
	exit 0
fi

if [ -z "${SEMANTIC_VERSION}" ]; then

	if [ -e "${DOCKERDIR}/version.txt" ]; then
		export SEMANTIC_VERSION=$(cat ${DOCKERDIR}/version.txt)
	else
		SEMANTIC_VERSION=$(cat ${DOCKERFILE} | grep '^FROM.*' | sed "s/^.*:\(.*\)/\1/" )

		if [ -e "${DOCKERDIR}/version-postfix.txt" ]; then
			export SEMANTIC_VERSION=${SEMANTIC_VERSION}$(cat ${DOCKERDIR}/version-postfix.txt)
		fi
	fi
fi


DIRHASH=$(git log -n 1 --format="%h" -- ${DOCKERDIR})
if [ "${DIRHASH}" = "" ]; then
	DIRHASH=NOT_IN_GIT
fi


export DOCKER_IMAGE=${DOCKER_REGISTRY_HOST}${DOCKER_REPOSITORY_ORG}${DOCKER_REPOSITORY_NAME}:${SEMANTIC_VERSION}
export DOCKER_IMAGE_LATEST=${DOCKER_REGISTRY_HOST}${DOCKER_REPOSITORY_ORG}${DOCKER_REPOSITORY_NAME}:latest
export DOCKER_IMAGE_GITHASH=${DOCKER_REGISTRY_HOST}${DOCKER_REPOSITORY_ORG}${DOCKER_REPOSITORY_NAME}:${SEMANTIC_VERSION}-${DIRHASH}

if [ -z "${FORCE_REBUILD}" ]; then

	set +e
	echo "Check if version already in repo. ${DOCKER_IMAGE_GITHASH}"
	PULLRESULT=$(docker pull ${DOCKER_IMAGE_GITHASH} 2>&1)
	if [ "$?" = "0" ]; then
		echo ${DOCKER_IMAGE_GITHASH} is up to date.
		exit 0
	else
		echo ${DOCKER_IMAGE_GITHASH}: ${PULLRESULT}, building.
		echo ""
	fi
	set -e
fi

rm -rf ${DOCKERDIR}/.build
mkdir -p ${DOCKERDIR}/.build
mkdir -p ${DOCKERDIR}/.build/metadata


while [ ! -d "${DOCKERDIR}/.build/metadata" ]
do
  sleep 1
done

echo "Retrieving changelog for ${DOCKERDIR}"
LASTFIVECOMMITS=$(git log -5 --pretty=format:" %aD by %an. --- %s %n" -- ${DOCKERDIR} > ${DOCKERDIR}/.build/gitlog.log && cat ${DOCKERDIR}/.build/gitlog.log)
LAST_COMMITS_B64="$(echo "${LASTFIVECOMMITS}" | base64)"

pushd .

cd ${DOCKERDIR}

if [ -e "./build.sh" ]; then
	echo "Custom pre build script detected, sourcing"
	. ./build.sh
fi



if [ -z "$GIT_COMMIT" ]; then
	export GIT_COMMIT=$(git rev-parse HEAD)
	export GIT_URL=$(git config --get remote.origin.url)
	export BUILD_DATE=$(date)
fi

if [ -z "$BRANCH_NAME" ]; then
	export BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
fi


cat > ./.build/metadata/builddata.json <<_EOF_
{
  "buildDate": "$(date +%Y-%m-%dT%H:%M:%S)+00:00"
, "buildHostName": "${HOSTNAME}"
, "dockerImageTag":"${DOCKER_IMAGE_LATEST}"
, "dockerImageGithash":"${DOCKER_IMAGE_GITHASH}"
, "gitHash":"${DIRHASH}"
, "gitBranch":"${BRANCH_NAME}"
, "gitUrl":"${GIT_URL}"
, "gitCommit":"${GIT_COMMIT}"
, "lastCommits":"${LAST_COMMITS_B64}"
, "semanticVersion":"${SEMANTIC_VERSION}"
_EOF_


if [[ -f ./kube.yaml ]]; then
	mkdir -p ./.build/deployment/

	cat kube.yaml | sed -e "s|DOCKER_IMAGE|"${DOCKER_IMAGE_GITHASH}"|" > ./.build/deployment/kube.yaml
fi


if [[ -d ./deployment ]]; then
	mkdir -p ./.build/deployment/

	find ./deployment -name "*.yaml" -type f | xargs -n 1 -I {} bash -c 'cat "$@" | sed -e "s|DOCKER_IMAGE|"${DOCKER_IMAGE_GITHASH}"|" > ./.build/deployment/$(basename $@)  || exit 255' _ {}

fi


if [[ -d ./.build/deployment/ ]]; then
	echo "Packaging kubernetes deployment files with ${DOCKER_IMAGE}"
	set -e


	KUBECONFIG_B64=$(cd ./.build && tar -b 1 -zcv ./deployment/ 2>/dev/null | base64 )
fi

if [ ! -z "${KUBECONFIG_B64}" ]; then
	cat >> ./.build/metadata/builddata.json <<_EOF_
,"kubeConfigB64":"${KUBECONFIG_B64}"
_EOF_

fi

cat >> ./.build/metadata/builddata.json <<_EOF_
}
_EOF_

if [ -e ./shepherd.json ]; then
	echo "Have shepherd.json userdata file"
	cp ./shepherd.json ./.build/metadata/userdata.json
else
	echo "NO shepherd.json userdata file, generating displayname"
	cat > ./.build/metadata/userdata.json <<_EOF_
{  "displayName":"${DOCKER_REPOSITORY_ORG}${DOCKER_REPOSITORY_NAME}" }
_EOF_
fi

join-metadata-files ./.build/metadata/userdata.json ./.build/metadata/builddata.json > ./.build/metadata/shepherd.json

SHEPHERD_METADATA=$(cd ./.build/metadata && tar  -b 1 -zcv shepherd.json 2>/dev/null | base64 )

docker build -t ${DOCKER_IMAGE} -t ${DOCKER_IMAGE_LATEST} -t ${DOCKER_IMAGE_GITHASH} \
	--build-arg SHEPHERD_METADATA=${SHEPHERD_METADATA} \
	${DOCKER_BUILD_ARGS} \
	-f Dockerfile .

echo Built ${DOCKER_IMAGE}

if [ ! -z "${LAYERCACHE_TAR}" ]; then
	echo "Saving layer cache tar to ${LAYERCACHE_TAR} "
	docker save -o ${LAYERCACHE_TAR} ${DOCKER_IMAGE_LATEST}
fi

if [ "${PUSH_ARG}" = "push" ]; then
	docker push ${DOCKER_IMAGE}
	echo "pushed ${DOCKER_IMAGE}"
	docker push ${DOCKER_IMAGE_LATEST}
	echo "pushed ${DOCKER_IMAGE_LATEST}"
	docker push ${DOCKER_IMAGE_GITHASH}
	echo "pushed ${DOCKER_IMAGE_GITHASH}"
else
	echo "Not pushing ${DOCKER_IMAGE}"
fi

# TODO Error if docker image produced is not configured with enough information to deploy
# TODO Add SHEPHERD_METADATA arg and label to Dockerfile if missing.

popd >/dev/null

echo "Build exit" $(pwd)
