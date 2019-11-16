#!/usr/bin/env bash
THISDIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

set -eao pipefail

export PATH=$PATH:${THISDIR}/node_modules/.bin

echo "Rebuilding test images"
#(cd ${THISDIR}/test-infrastructure-image/ && ./build-docker.sh)
#(cd ${THISDIR}/test-migration-image/ && ./build-docker.sh)
#(cd ${THISDIR}/test-image && ./build-docker.sh)
#(cd ${THISDIR}/test-image2 && ./build-docker.sh)
#(cd ${THISDIR}/test-image3 && ./build-docker.sh)
#

(SEMANTIC_VERSION=0.0.99 shepherd-build-docker ${THISDIR}/test-image-json-metadata/Dockerfile)

(SEMANTIC_VERSION=0.0.66 shepherd-build-docker ${THISDIR}/test-migration-image-newformat/Dockerfile)
