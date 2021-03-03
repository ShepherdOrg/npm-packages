#!/usr/bin/env bash

INFRASTRUCTURE_STACK_NAME=$1

BRANCH_NAME=$2


export WEB_API_STACK_NAME=myip-${BRANCH_NAME}

DEPLOYMENT_BUCKET_REGION=eu-west-1

FUNCTION_NAME=myip

DEPLOYMENT_BUCKET_NAME=$(aws cloudformation describe-stacks --region eu-west-1 --stack-name ${INFRASTRUCTURE_STACK_NAME} --query "Stacks[0].Outputs[?OutputKey=='lambdaDeploymentBucketName'].OutputValue" --output text)

DEPLOYMENT_S3_PATH="s3://${DEPLOYMENT_BUCKET_NAME}/${BRANCH_NAME}/${FUNCTION_NAME}.zip"

set -e

aws lambda update-function-code --region eu-west-1 --function-name ${BRANCH_NAME}-${FUNCTION_NAME} --s3-bucket ${DEPLOYMENT_BUCKET_NAME} --s3-key ${BRANCH_NAME}/${FUNCTION_NAME}.zip --publish > /dev/null

export API_INVOKE_ENDPOINT=$(./get-api-uri.sh ${WEB_API_STACK_NAME})


npm run e2e-test


