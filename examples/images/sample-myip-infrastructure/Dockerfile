# FROM https://github.com/stefaneg/cloudformation-deployer/blob/master/Dockerfile
FROM gulli/cloudformation-deployer:0.1-13

ADD . .

ARG SHEPHERD_METADATA
LABEL shepherd.metadata=${SHEPHERD_METADATA}
