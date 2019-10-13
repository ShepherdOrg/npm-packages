#!/usr/bin/env bash

if [ -z "${BRANCH_NAME}" ] || [ "${BRANCH_NAME}" = "HEAD" ]; then
	BRANCH_NAME=$(git branch | grep \* | cut -d ' ' -f2)
	if [[ ${BRANCH_NAME} == *"detached"*  ]]; then
		BRANCH_NAME=$(git log -n 1 --pretty=%d HEAD | cut -d / -f 2 | rev | cut -c 2- | rev)
	fi
	echo -n "${BRANCH_NAME}"
fi
