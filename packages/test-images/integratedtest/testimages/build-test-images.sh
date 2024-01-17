#!/usr/bin/env bash
THISDIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )


set -eao pipefail
unset DOCKER_REGISTRY_HOST
export FORCE_REBUILD=true


echo "Rebuilding test images"
(cd ${THISDIR}/test-migration-image/ && ./build-docker.sh)
(cd ${THISDIR}/test-image && ./build-docker.sh)
(cd ${THISDIR}/test-image2 && ./build-docker.sh)
(cd ${THISDIR}/test-image3 && ./build-docker.sh)

(SEMANTIC_VERSION=0.0.2 shepherd-build-docker ${THISDIR}/test-infrastructure/Dockerfile)

(SEMANTIC_VERSION=0.0.99 shepherd-build-docker ${THISDIR}/test-image-json-metadata/Dockerfile)

(SEMANTIC_VERSION=0.0.66 shepherd-build-docker ${THISDIR}/test-migration-image-newformat/Dockerfile)

(SEMANTIC_VERSION=0.7.77 shepherd-build-docker ${THISDIR}/test-deployer-image-with-deployment-tests/Dockerfile)

(SEMANTIC_VERSION=0.8.88 shepherd-build-docker ${THISDIR}/test-k8s-image-with-deployment-tests/Dockerfile)

(SEMANTIC_VERSION=0.4.44 shepherd-build-docker ${THISDIR}/test-image-with-yaml-wrecking-hbs/Dockerfile)
