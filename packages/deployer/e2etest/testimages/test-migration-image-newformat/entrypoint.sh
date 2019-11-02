#!/bin/sh
set -e

if [[ -z "${MIGRATION_ENV_VARIABLE_ONE}" ]]
then
  echo "Did not get MIGRATION_ENV_VARIABLE_ONE"
  exit 255
fi


