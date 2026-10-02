import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
test('RabbitMQ keeps its immutable base and explicit reviewed OpenSSL patch pins', () => {
  const source = fs.readFileSync(new URL('infra/docker/rabbitmq/Dockerfile', root), 'utf8');
  assert.match(source, /^FROM rabbitmq:4\.3\.5-alpine@sha256:3486d98205df3d6395ed70e7924baa13b561cbac54116c0ddae5b0b7382bbabd$/mu);
  assert.match(source, /^RUN apk add --no-cache --upgrade libcrypto3=3\.5\.9-r0 libssl3=3\.5\.9-r0$/mu);
  assert.match(source, /USER 999:999\s*$/u);
});
test('runtime acceptance checks and reports both installed OpenSSL package versions', () => {
  const source = fs.readFileSync(new URL('scripts/runtime/rabbitmq/verify.py', root), 'utf8');
  assert.match(source, /'apk', 'info', '--exists', \*openssl_packages/u);
  assert.match(source, /openssl_packages = \['libcrypto3=3\.5\.9-r0', 'libssl3=3\.5\.9-r0'\]/u);
  assert.match(source, /assert sorted\(installed\) == \['libcrypto3', 'libssl3'\]/u);
  assert.match(source, /'openssl_packages':openssl_packages/u);
});
