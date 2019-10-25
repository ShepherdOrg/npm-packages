#!/usr/bin/env bash
set -e

THISDIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

TESTMODE=$1

export PATH=$(pwd)/e2etest/testbin:$(pwd)/bin:${PATH}

if [ -z "${DRYRUN_OUTPUT_FOLDER}" ]; then
	export DRYRUN_OUTPUT_FOLDER=./.testdata/.build/kubeapply
fi

mkdir -p ${DRYRUN_OUTPUT_FOLDER}
rm -rf ${DRYRUN_OUTPUT_FOLDER}/*

if [ ! -d "${DRYRUN_OUTPUT_FOLDER}" ]; then
  echo "${DRYRUN_OUTPUT_FOLDER} not created !!"
  exit 44
fi

mkdir -p /tmp/infrastructure-exports/
rm -rf /tmp/infrastructure-exports/*


if [ "${TESTMODE}" = "--dryrun" ]; then
  export DRYRUN_MODE=$TESTMODE
fi

if [ "${TESTMODE}" = "--dryrun" ]; then
	mkdir -p "${DRYRUN_OUTPUT_FOLDER}"
	DRYRUN_PARAM="--dryrun"
	export DRYRUN_OUTPUT_DIR_PARAM="--outputDir ${DRYRUN_OUTPUT_FOLDER}"
fi

if [ "${TESTMODE}" = "--testrun-mode" ]; then
	mkdir -p "${DRYRUN_OUTPUT_FOLDER}"
	DRYRUN_PARAM="--dryrun"
	export DRYRUN_OUTPUT_DIR_PARAM="--outputDir ${DRYRUN_OUTPUT_FOLDER}"
fi



 SHEPHERD_FILESTORE_DIR="./.build/.shepherdstore" \
 www_icelandair_com_image=www-image:99 \
 PREFIXED_TOP_DOMAIN_NAME=testtopdomain \
 SUB_DOMAIN_PREFIX=testSDP \
 WWW_ICELANDAIR_IP_WHITELIST=$(echo teststring | base64) \
 DEBUG_MODE=false \
 PERFORMANCE_LOG=false \
 MICROSERVICES_POSTGRES_RDS_HOST=postgres-local \
 MICRO_SITES_DB_PASSWORD=somedbpass \
 ENV=testit \
 EXPORT1=nowhardcoded \
 ./bin/shepherd.js "$(pwd)/src/deployment-manager/testdata/happypath/herd.yaml" e2etestenv ${DRYRUN_PARAM} ${DRYRUN_OUTPUT_DIR_PARAM}

sleep 1s
