#!/usr/bin/env bash

docker tag alpine:3.4 localhost:5000/alpine:3.4
docker push localhost:5000/alpine:3.4

docker tag shepherdorg/shepherd localhost:5000/shepherd
docker push localhost:5000/shepherd

docker tag shepherdorg/shepherd localhost:5500/shepherd
docker --config ./docker-config  --tlscert ./certs/domain.crt  push localhost:5500/shepherd
