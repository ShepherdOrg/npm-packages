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

export THISDIR=$(installationDir ${BASH_SOURCE[0]})

set -e

if [ -f "${PWD}/deployments.env" ]; then
	. "${PWD}/deployments.env"
fi

export HERDFILE=$1
HERDFILE_DIR=$(dirname ${HERDFILE})

if [[ "$*" == *--dryrun*  || "$*" == *--export* ]]
then
    DRYRUN_CONFIG_FILE="${HERDFILE_DIR}/dryrun.env"

    if [ -e "${DRYRUN_CONFIG_FILE}" ]; then
      echo "Dryrun or export specified, loading dryrun environment from ${DRYRUN_CONFIG_FILE}"
    	source "${DRYRUN_CONFIG_FILE}"
    fi
fi

HERDCONFIG_FILE="${HERDFILE_DIR}/herd.env"

if [ -e "${HERDCONFIG_FILE}" ]; then
	source "${HERDCONFIG_FILE}"
	echo "Loaded environment ${ENV} config from ${HERDCONFIG_FILE}"
else
	echo "Environment config file "${HERDCONFIG_FILE}" is required."
	exit 255
fi

if [ -e ~/.shepherd/${ENV}.env ]
then
	echo "Using environment defined in ~/.shepherd/${ENV}.env. Used for development purposes when running deployment from a developer machine."
	export DEV_MODE="true"
	source ~/.shepherd/${ENV}.env
fi

shepherd.js "$@"
