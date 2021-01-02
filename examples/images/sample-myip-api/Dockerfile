# https://github.com/stefaneg/cloudformation-deployer/blob/master/Dockerfile
FROM gulli/cloudformation-deployer:0.1-13

ADD package.json .
ADD package-lock.json .

RUN npm ci

ADD ./src ./src

RUN npm run test

RUN npm run build

ADD --chown=deployeruser:deployergroup . .

ARG SHEPHERD_METADATA
LABEL shepherd.metadata=${SHEPHERD_METADATA}
