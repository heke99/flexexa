# The generated source and complete module checksums are reviewed in this repository.
FROM golang:1.27-alpine3.23@sha256:d9e2f2f07b10cc922da3e80e035c3058810b328d5aef82d2c63680967c5e2ec9 AS build
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
WORKDIR /src
COPY collector/ ./
RUN sha256sum go.mod go.sum > /tmp/modules.sha256 && \
    go mod download && go mod verify && \
    go build -mod=readonly -trimpath -tags=grpcnotrace -ldflags="-buildid=" -o /flexexa-otelcol . && \
    sha256sum -c /tmp/modules.sha256 && go version -m /flexexa-otelcol

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build --chmod=755 /flexexa-otelcol /flexexa-otelcol
USER 65532:65532
ENTRYPOINT ["/flexexa-otelcol"]
