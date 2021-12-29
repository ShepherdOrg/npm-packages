FROM node

WORKDIR /test

RUN npm install @shepherdorg/cli

ADD ./test/node_modules/@shepherdorg/cli/bin/shepherd-build-docker.sh /test/node_modules/@shepherdorg/cli/bin

RUN /test/node_modules/@shepherdorg/cli/bin/shepherd-build-docker.sh --verifyInstall

ARG SHEPHERD_METADATA
LABEL shepherd.metadata=${SHEPHERD_METADATA}
