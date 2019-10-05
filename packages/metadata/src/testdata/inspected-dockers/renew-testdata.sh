#!/usr/bin/env bash

docker inspect testenvimage2 > testenvimage2.json
docker inspect testenvimage > testenvimage.json
docker inspect testenvimage-migrations > testenvimage-migrations.json
docker inspect test-infrastructure > test-infrastructure.json
docker inspect testenvimage > testenvimage.json
docker inspect public-repo-with-deployment-dir:latest > public-repo-with-deployment-dir.json
docker inspect public-repo-with-kube-yaml > public-repo-with-kube-yaml.json
docker inspect plain-deployer-repo > plain-deployer-repo.json
