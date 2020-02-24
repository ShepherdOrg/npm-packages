#!/bin/sh

echo Executing docker command "$@"
if [ "$1" = "rollback" ]; then
	echo Rolled back to last good version
	exit 0
elif [ "$1" = "deploy" ]; then
	echo Yessir, deploying now
	exit 0
elif [ "$1" = "pretest" ]; then
	echo Pre test successful
	exit 0
elif [ "$1" = "posttest" ]; then
	echo Post test failed
	exit 2
else
	exec "$@"
fi
