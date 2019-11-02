FROM alpine:3.4

ADD ./entrypoint.sh ./entrypoint.sh

ARG SHEPHERD_METADATA
LABEL shepherd.metadata=${SHEPHERD_METADATA}

ENTRYPOINT ["./entrypoint.sh"]
