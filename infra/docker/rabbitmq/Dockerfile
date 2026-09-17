FROM rabbitmq:4.3.5-alpine@sha256:3486d98205df3d6395ed70e7924baa13b561cbac54116c0ddae5b0b7382bbabd
# CVE-2026-14456: patch the two vendor-image OpenSSL packages; keep ABI 3.
USER 0:0
RUN apk add --no-cache --upgrade libcrypto3=3.5.8-r0 libssl3=3.5.8-r0
USER 999:999
