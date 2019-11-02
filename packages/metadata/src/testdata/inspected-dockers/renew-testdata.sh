#!/usr/bin/env bash

docker inspect testenvimage2:999.999.99999 > testenvimage2.json
docker inspect testenvimage:0.0.0 > testenvimage.json
# docker inspect testenvimage-migrations:0.0.0 > testenvimage-migrations.json This one is modified by hand, updating it will break tests.
docker inspect test-infrastructure:0.0.1 > test-infrastructure.json
docker inspect testenvimage:0.0.0 > testenvimage.json
docker inspect public-repo-with-deployment-dir:latest > public-repo-with-deployment-dir.json
docker inspect public-repo-with-kube-yaml:latest > public-repo-with-kube-yaml.json
docker inspect plain-deployer-repo:latest > plain-deployer-repo.json
docker inspect alpine:latest > alpine.json
docker inspect test-migration-image-newformat:0.0.66  > test-migration-image-newformat.json
