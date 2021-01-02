#!/usr/bin/env bash

export STACK_NAME=$1

aws cloudformation describe-stacks --region eu-west-1 --stack-name ${STACK_NAME} --query "Stacks[0].Outputs[?OutputKey=='apiGatewayInvokeURL'].OutputValue" --output text
