# MyIP API 

Simple AWS lambda API deployment to demonstrate how Shepherd is used to package and deploy using AWS CloudFormation,
executing an end-to-end test after deployment. 

Demonstrates
- Deployment to cloud using docker & shepherd
- E2e test execution
- Branch deployment support

Does not support
- Rollback on test failure


Build locally

```
export DOCKER_USER=gulli
./build-docker.sh
```


Running

```
docker run -e DOCKER_USER=YourDockerUserName  -v $HOME/.aws:/home/deployeruser/.aws $DOCKER_USER/cicdw-myip-api master 

```


Running unit tests


```
docker run -v $(pwd):/home/deployeruser -it gulli/cloudformation-deployer /bin/bash

npm ci
npm run test

```
