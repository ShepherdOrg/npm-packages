FROM alpine:latest

ADD entrypoint.sh ./entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]

ARG SHEPHERD_METADATA
LABEL shepherd.metadata=${SHEPHERD_METADATA}
