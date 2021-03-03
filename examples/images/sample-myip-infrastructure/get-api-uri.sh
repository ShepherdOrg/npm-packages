#!/usr/bin/env bash

. ./bashfunctions

API_STACK_NAME=$1

requireVariable API_STACK_NAME

aws cloudformation describe-stacks --region eu-west-1 --stack-name ${API_STACK_NAME} --query "Stacks[0].Outputs[?OutputKey=='apiGatewayInvokeURL'].OutputValue" --output text
