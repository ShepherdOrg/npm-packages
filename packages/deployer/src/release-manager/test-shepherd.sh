#!/usr/bin/env bash
set -e

THISDIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

export KUBECONFIG=/deployments/images.yaml # Needs to point to existing file for kubectl commands to be run.

export PATH=${THISDIR}/../../testbin:${THISDIR}/../../bin:${PATH}

if [ -z "${KUBECTL_OUTPUT_FOLDER}" ]; then
	export KUBECTL_OUTPUT_FOLDER=/testdata/.build/kubeapply
fi

mkdir -p ${KUBECTL_OUTPUT_FOLDER}
rm -rf ${KUBECTL_OUTPUT_FOLDER}/*

mkdir -p /tmp/infrastructure-exports/
rm -rf /tmp/infrastructure-exports/*

export INFRASTRUCTURE_IMPORTED_ENV="thatsme"

export TESTRUN_MODE=$1
if [ ! -z "${TESTRUN_MODE}" ]; then
	mkdir -p /testdata/.build/testexport
	export TESTOUTPUT_DIR=/testdata/.build/testexport
fi

cd ${THISDIR}/.. && \
 www_icelandair_com_image=www-image:99 \
 PREFIXED_TOP_DOMAIN_NAME=testtopdomain \
 SUB_DOMAIN_PREFIX=testSDP \
 WWW_ICELANDAIR_IP_WHITELIST=$(echo teststring | base64) \
 DEBUG_MODE=false \
 DEBUG_LOG= \
 PERFORMANCE_LOG=false \
 MICROSERVICES_POSTGRES_RDS_HOST=postgres-local \
 MICRO_SITES_DB_PASSWORD=somedbpass \
 ENV=testit \
 shepherd.js "${THISDIR}/testdata/happypath/herd.yaml" ${TESTRUN_MODE} ${TESTOUTPUT_DIR}

sleep 1s
