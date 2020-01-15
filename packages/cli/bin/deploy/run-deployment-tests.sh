#!/usr/bin/env bash

if [ -z "$THISDIR" ]; then
	echo "THISDIR needs to be set by caller, exiting"
	exit 666
fi

source ${PWD}/deployments.env

echo "Running deployment tests"

tmpdir=/tmp/testrun

rm -rf ${tmpdir} && mkdir ${tmpdir}

. ${THISDIR}/deploy/functions.sh

pullIfLatest

export ENV=testrun

echo "Creating testrun directory and cleaning files"
mkdir -p ${PWD}/testrun > /dev/null 2>&1
rm -f ${PWD}/deployments/central/testreference/*sorted
rm -rf ${PWD}/testrun/*

echo "Testrun files cleaned"

set -e

echo "Loading environment for testrun from ${PWD}/deployments/central/testrun.env"

source ${PWD}/testreference/central/testrun.env
source ${PWD}/load-deprecated-secret-env.sh

if [ ! -z "${UPSTREAM_IMAGE_URL}" ]; then
	# When triggered deployment, only compare generated files, do not check if all deployments are performed.
	export TEST_PARTIAL_DEPLOYMENT=true
fi

generateMigrationEnv
# cat ${tmpdir}/_parameterlist.env

TOOLCHAIN_PARAMS="./test-deployments.sh"

echo "Testing deployment. Full test log located in /tmp/testrun.log"
echo "shepherdorg/shepherd:${SHEPHERD_VERSION} ${TOOLCHAIN_PARAMS}"
set +e
docker run \
	-v /var/run/docker.sock:/var/run/docker.sock \
	-v ${HOME}/.docker:/root/.docker \
	-e "ENV=${ENV}" \
	-v /tmp:/tmp \
	-v ${PWD}/testrun:/testrun \
	-v ${PWD}/testreference/central/:/testreference \
    -v ${PWD}/deployments:/deployments \
    --network host \
	--env-file ${tmpdir}/_parameterlist.env \
	--rm \
	shepherdorg/shepherd:${SHEPHERD_VERSION} ${TOOLCHAIN_PARAMS} > /tmp/testrun.log 2>&1
TESTEXITCODE=$?
if [ ! "${TESTEXITCODE}" = "0" ]; then
	cat /tmp/testrun.log
else
	echo "Test results:"
	tail -n 2 /tmp/testrun.log
fi
exit ${TESTEXITCODE}
