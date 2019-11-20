#!/bin/bash -e

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == "master" ]]; then
    COMMIT=$(git rev-parse HEAD~1)
else
    COMMIT=$(git merge-base origin/master HEAD)
fi

echo "$COMMIT"
