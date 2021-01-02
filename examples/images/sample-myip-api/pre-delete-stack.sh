#!/usr/bin/env bash

INFRASTRUCTURE_STACK_NAME=$1

BRANCH_NAME=$2

WEB_API_STACK_NAME=myip-${BRANCH_NAME}

export STACK_NAME=${WEB_API_STACK_NAME} # Used in create-or-update-stack

DEPLOYMENT_BUCKET_REGION=eu-west-1

FUNCTION_NAME=myip

DEPLOYMENT_BUCKET_NAME=$(aws cloudformation describe-stacks --region eu-west-1 --stack-name ${INFRASTRUCTURE_STACK_NAME} --query "Stacks[0].Outputs[?OutputKey=='lambdaDeploymentBucketName'].OutputValue" --output text)

DEPLOYMENT_S3_PATH="s3://${DEPLOYMENT_BUCKET_NAME}/${BRANCH_NAME}/${FUNCTION_NAME}.zip"

echo "Will remove ${DEPLOYMENT_S3_PATH}"

aws s3 rm ${DEPLOYMENT_S3_PATH}
