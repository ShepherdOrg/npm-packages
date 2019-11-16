#!/bin/sh

set -e

if [ ! "${INFRASTRUCTURE_IMPORTED_ENV}" = "thatsme" ]; then
	echo "INFRASTRUCTURE_IMPORTED_ENV should be imported into docker env for infrastructure image"
	exit 255
fi

echo "EXPORT1=value1" >> /exports/export.env
echo "EXPORT2=value2" >> /exports/export.env
echo "EXPORT2=value3" >> /exports/export.env
echo "Test infrastructure output you can see here"

# Disable psql test for now, introduces flakyness to tests.
# psql -v ON_ERROR_STOP=1 -P pager=off --single-transaction -U postgres -h localhost -d postgres -p 5433 -c 'SELECT now()::timestamp'

# echo "psql DONE"