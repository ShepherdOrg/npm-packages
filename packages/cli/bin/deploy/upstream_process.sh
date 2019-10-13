#!/usr/bin/env bash

if [ ${UPSTREAM_IMAGE_NAME} = "none" ]; then
	# "UPSTREAM_IMAGE_NAME input from upstream build not set, exiting."
	exit 0
fi

set -e
source ${PWD}/deployments.env

if [ -z "${SHEPHERD_VERSION}" ]; then
	echo "SHEPHERD_VERSION not set, cannot continue"
	exit -1
fi

if [ "${SHEPHERD_VERSION}" = "latest" ]
then
	echo "pulling latest shepherd version shepherdorg/shepherd:${SHEPHERD_VERSION}"
	docker pull shepherdorg/shepherd:${SHEPHERD_VERSION}
fi

# Upgrade image references in all images.yaml files found in deployments.
export commitmessage="Nothing done"
function upgrade(){
	echo "Upgrading $1" > debug.log
	IMAGEYAMLFILE=$1

	docker run \
	    -e UPSTREAM_IMAGE_NAME \
	    -e UPSTREAM_IMAGE_TAG \
	    -v ${PWD}/deployments:/deployments \
	    --rm \
		shepherdorg/shepherd:${SHEPHERD_VERSION} /code/deploy-images/upgrade_image_version.js ${IMAGEYAMLFILE}
}

export -f upgrade

find ${PWD}/deployments -name "images.yaml" -o -name "herd.yaml"


commitmessage=$(find ${PWD}/deployments -name "images.yaml" -o -name "herd.yaml" | sed -e "s|${PWD}||" | xargs -n 1 -I {} bash -c 'upgrade $@ || exit 255' _ {})


filestocommit=$(find ${PWD}/deployments -name "images.yaml" -o -name "herd.yaml"  | sed -e "s|${PWD}/||" | xargs -n 1 -I {} bash -c 'echo -n "$@ "' _ {})

set +e

if [ "$1" = "dryrun" ]; then
	echo "will run commitresult=git commit -m "${commitmessage}" ${filestocommit}"
fi

commitresult=$(git commit -m "${commitmessage}" ${filestocommit})
GITEXITCODE=$?
if [ "${GITEXITCODE}" = "1" ];then
	echo "No changes made"
else
	echo "${commitresult}"
fi
