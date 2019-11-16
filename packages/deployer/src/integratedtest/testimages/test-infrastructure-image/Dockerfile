FROM postgres:latest
ADD .pgpass /root/.pgpass
RUN chmod 600 /root/.pgpass

ADD entrypoint.sh ./entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]

LABEL shepherd.name="Infrastructure"

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

LABEL shepherd.environment.variables="DB_HOST=\${MICROSERVICES_POSTGRES_RDS_HOST},DB_PASS=\$MICRO_SITES_DB_PASSWORD"

# Means it will receive full environment. Should be specified in infrastructure section.
# Will get a /exports/ mount for exporting infrastructure environment when required. NOTE: This is a fallback when other
# means for service/resource discovery are not available. Most often, DNS services should be used.
# Infrastructure images will also be executed ahead of other if there are multiple changes.
LABEL shepherd.infrastructure="true"

