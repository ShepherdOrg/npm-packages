#!/usr/bin/env bash
set -e

THISDIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

echo "Testing Shepherd, pwd $(pwd)"

export KUBECONFIG=/deployments/images.yaml # Needs to point to existing file for kubectl commands to be run.

export PATH=$(pwd)/e2etest/testbin:$(pwd)/bin:${PATH}

echo "PATH $PATH"

if [ -z "${KUBECTL_OUTPUT_FOLDER}" ]; then
	export KUBECTL_OUTPUT_FOLDER=./.testdata/.build/kubeapply
fi

mkdir -p ${KUBECTL_OUTPUT_FOLDER}
rm -rf ${KUBECTL_OUTPUT_FOLDER}/*

if [ ! -d "${KUBECTL_OUTPUT_FOLDER}" ]; then
  echo "${KUBECTL_OUTPUT_FOLDER} not created !!"
  exit 44
fi

mkdir -p /tmp/infrastructure-exports/
rm -rf /tmp/infrastructure-exports/*

export INFRASTRUCTURE_IMPORTED_ENV="thatsme"

export TESTRUN_MODE=$1
if [ ! -z "${TESTRUN_MODE}" ]; then
	mkdir -p "$(pwd)/.testdata/.build/testexport"
	export TESTOUTPUT_DIR=$(pwd)/.testdata/.build/testexport
fi

 www_icelandair_com_image=www-image:99 \
 PREFIXED_TOP_DOMAIN_NAME=testtopdomain \
 SUB_DOMAIN_PREFIX=testSDP \
 WWW_ICELANDAIR_IP_WHITELIST=$(echo teststring | base64) \
 DEBUG_MODE=false \
 KUBECTL_DEBUG_LOG=false \
 PERFORMANCE_LOG=false \
 MICROSERVICES_POSTGRES_RDS_HOST=postgres-local \
 MICRO_SITES_DB_PASSWORD=somedbpass \
 ENV=testit \
 EXPORT1=nowhardcoded \
 shepherd.js "${THISDIR}/testdata/happypath/herd.yaml" ${TESTRUN_MODE} ${TESTOUTPUT_DIR}

sleep 1s
