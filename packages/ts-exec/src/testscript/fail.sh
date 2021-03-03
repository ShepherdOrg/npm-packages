#!/usr/bin/env bash

echo "This message must go to stdout"
>&2 echo "This message must go to stderr"

exit 42
