#!/bin/sh

echo Executing docker command "$@"
if [ "$1" = "pretest" ]; then
	echo Pre test failed
	exit 2
else
	exec "$@"
fi
