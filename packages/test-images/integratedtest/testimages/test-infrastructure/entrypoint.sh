#!/bin/sh

set -e

if [ ! "${INFRASTRUCTURE_IMPORTED_ENV}" = "thatsme" ]; then
	echo "INFRASTRUCTURE_IMPORTED_ENV should be imported into docker env for infrastructure image"
	exit 255
fi
