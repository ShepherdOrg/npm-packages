FROM alpine:3.4

ADD ./entrypoint.sh ./entrypoint.sh


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

ARG KUBECONFIG_B64
LABEL shepherd.kube.config.tar.base64=${KUBECONFIG_B64}


ENTRYPOINT ["./entrypoint.sh"]