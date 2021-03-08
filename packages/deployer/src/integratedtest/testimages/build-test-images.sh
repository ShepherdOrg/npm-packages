#!/usr/bin/env bash
THISDIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

set -eao pipefail
unset DOCKER_REGISTRY_HOST
export PATH=$PATH:${THISDIR}/node_modules/.bin
export FORCE_REBUILD=true

echo "Rebuilding test images"
(cd ${THISDIR}/test-migration-image/ && ./build-docker.sh)
(cd ${THISDIR}/test-image && ./build-docker.sh)
(cd ${THISDIR}/test-image2 && ./build-docker.sh)
(cd ${THISDIR}/test-image3 && ./build-docker.sh)

(shepherd-build-docker ${THISDIR}/test-infrastructure/Dockerfile)
(shepherd-build-docker ${THISDIR}/test-image-json-metadata/Dockerfile)
(shepherd-build-docker ${THISDIR}/test-migration-image-newformat/Dockerfile)
(shepherd-build-docker ${THISDIR}/test-deployer-image-with-deployment-tests/Dockerfile)
(shepherd-build-docker ${THISDIR}/test-k8s-image-with-deployment-tests/Dockerfile)
(shepherd-build-docker ${THISDIR}/test-image-with-yaml-wrecking-hbs/Dockerfile)
(shepherd-build-docker ${THISDIR}/test-deployer-image-with-deployment-tests/Dockerfile)
(shepherd-build-docker ${THISDIR}/test-image-with-pre-deployment-tests/Dockerfile)
