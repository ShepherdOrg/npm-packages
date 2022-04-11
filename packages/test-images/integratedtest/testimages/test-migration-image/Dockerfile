FROM alpine:3.4

LABEL shepherd.name="Testimage"

ARG BRANCH_NAME
LABEL shepherd.git.branch=${BRANCH_NAME}

ARG GIT_URL
LABEL shepherd.git.url=${GIT_URL}

ARG GIT_HASH
LABEL shepherd.git.hash=${GIT_HASH}

ARG SEMANTIC_VERSION
LABEL shepherd.version=${SEMANTIC_VERSION}

ARG LAST_COMMITS
LABEL shepherd.lastcommits=${LAST_COMMITS}

ARG BUILD_DATE
LABEL shepherd.builddate=${BUILD_DATE}

LABEL shepherd.environment.variables="EXPORT1=\${EXPORT1},DB_HOST=\${MICROSERVICES_POSTGRES_RDS_HOST},DB_PASS=\$MICRO_SITES_DB_PASSWORD,THIS_IS_DEPLOYER_ONE=true"

LABEL shepherd.deployer="true"
LABEL shepherd.deployer.command="ls"
