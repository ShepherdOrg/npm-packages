#!/usr/bin/env bash

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
	$(basename ${BASH_SOURCE[0]}) [herdfile] <options>"

Options:
	--help                   Display this message
	--dryrun                 Pretend to deploy, output deployment actions to console and write deployment documents to ./dryrun directory.
	--version                Display detailed version information about shepherd deployer agent.
_EOF_


}

export THISDIR=$(installationDir ${BASH_SOURCE[0]})

. ${THISDIR}/deploy/functions.sh



if has_param '--help' "$@"; then
	outputUsage
	exit 0
fi


export HERDFILE=$1



set -e

if [ -f ${PWD}/deployments.env ]; then
	. ${PWD}/deployments.env
fi

if [ -e ~/.shepherd/${ENV}.env ]
then
	echo "Using environment defined in ~/.shepherd/${ENV}.env. Used for development purposes when running deployment from a developer machine."
	export DEV_MODE="true"
	source ~/.shepherd/${ENV}.env
fi


if [ -z "${SHEPHERD_VERSION}" ]; then
	echo "WARNING: Shepherd version not configured, defaulting to latest"
	export SHEPHERD_VERSION=latest
fi

export SHEPHERD_IMAGE=shepherdorg/shepherd:${SHEPHERD_VERSION}

pullIfLatest

if has_param '--version' "$@"; then
	shepherd-inspect ${SHEPHERD_IMAGE}
	exit 0
fi


if [ ! -e "${HERDFILE}" ]; then
	outputUsage
	exit -1
else
	echo "Deploying from  $(absolutepath ${HERDFILE})"
fi


tmpdir=$(mktemp -d)
trap "rm -rf ${tmpdir}" EXIT

export HERDFILE_DIR=$(dirname ${HERDFILE})

export HERDCONFIG_FILE="${HERDFILE_DIR}/herd.env"

if [ -e "${HERDCONFIG_FILE}" ]; then
	source "${HERDCONFIG_FILE}"
	echo "Loaded environment config for ${HERDFILE}"
else
	echo "Environment config file "${HERDCONFIG_FILE}" not found"
	exit -1
fi


if has_param '--dryrun' "$@"; then
    echo "Lets dryrun deployments from ${HERDFILE}"

	DRYRUN_CONFIG_FILE=${HERDFILE_DIR}/dryrun.env
	if [ -e "${DRYRUN_CONFIG_FILE}" ]; then
		source "${DRYRUN_CONFIG_FILE}"
	fi
    # We hardcode ENV to testrun during dry-runs
	export ENV=testrun

	if [ ! -z "${UPSTREAM_IMAGE_NAME}" ]; then
		# When triggered deployment, only compare generated files, do not check if all deployments are performed.
		export TEST_PARTIAL_DEPLOYMENT=true
	fi

	SHEPHERD_PARAMS="./deployment-dryrun.sh /deployments/herd.yaml"

else
    echo "Lets not deploy for real for now "
	exit 255
fi

generateDeploymentEnv

if has_param '--debug' "$@"; then
	echo "--------------------DOCKER ENV LIST FOLLOWS ----------------------------------------"
	echo "From file: ${tmpdir}/_parameterlist.env"
	cat ${tmpdir}/_parameterlist.env
	echo "--------------------DOCKER ENV LIST ABOVE ----------------------------------------"
fi

if has_param '--dryrun' "$@"; then

	echo "Running deployment dryrun. Full log located in /tmp/dryrun.log"
	set +e

	docker run \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v ${HOME}/.docker:/root/.docker \
		-v ${HOME}/.shepherdstore:/root/.shepherdstore \
		-e "ENV=${ENV}" \
	    -v /tmp:/tmp \
		-v ${PWD}/dryrun:/dryrun \
		-v ${PWD}/${HERDFILE}:/deployments/herd.yaml \
		--network host \
		--env-file ${tmpdir}/_parameterlist.env \
		--rm \
		shepherdorg/shepherd:${SHEPHERD_VERSION} ${SHEPHERD_PARAMS} 2>&1 | tee /tmp/dryrun.log
	TESTEXITCODE=$?
	if [ ! "${TESTEXITCODE}" = "0" ]; then
		echo "Dryrun failed with exit code ${TESTEXITCODE}, execution log follows."
		cat /tmp/dryrun.log
	else
		tail -n 1 /tmp/dryrun.log
	fi
	exit ${TESTEXITCODE}
else
	docker run \
			-v /var/run/docker.sock:/var/run/docker.sock \
			-v ${HOME}/.docker:/root/.docker \
			-v ${SHEPHERD_KUBECONFIG}:/root/.kube/config \
		    -v ~/.ssh:/root/.ssh \
			-v ${HOME}/.shepherdstore:/root/.shepherdstore \
		    -v /tmp:/tmp \
		    -v ${PWD}/${HERDFILE}:/deployments/herd.yaml \
		    --network host \
		    --env-file ${tmpdir}/_parameterlist.env \
		    --rm \
		${SHEPHERD_IMAGE} /deployments/herd.yaml
	echo "Shepherd deployments complete"
fi
