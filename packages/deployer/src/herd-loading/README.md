# Herd load testing

In order to be able to unit test herd loading without a running docker daemon, herd-loader.spec.ts
depends on a mock metadata loader that loads docker metadata from the filesystem instead.

To create a test with a new test data variant, you need to create a docker image first with the variant,
usually in the [testimages folder](../integratedtest/testimages), build the image, add the image to
[renew testdata](./testdata/inspected-dockers/renew-testdata.sh), and run renew testdata script.

Then you can add an image reference to a herd of your choosing and test from that.
