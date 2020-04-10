#!/bin/sh

echo Executing docker command "$@"
if [ "$1" = "pretest" ]; then
	echo Pre test exit with code ${PRETEST_EXITCODE}
	exit ${PRETEST_EXITCODE}
elif [ "$1" = "posttest" ]; then
	echo Post test exit with code ${POSTTEST_EXITCODE}
	exit ${POSTTEST_EXITCODE}
else
	exec "$@"
fi
