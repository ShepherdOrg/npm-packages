#!/bin/sh

echo "LineOne"
echo "LineTwo"
>&2 echo "TESTING LINE-BY-LINE ERROR OUTPUT"
echo "LineThree should be shown"

