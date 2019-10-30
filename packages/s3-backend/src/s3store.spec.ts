import { createS3Store, S3Store } from "./index"

import testBackend from "@shepherdorg/storage-backend-tester"

testBackend("s3 object", () => {
  const isE2E = Boolean(process.env.E2E)
  const localCache = {}
  const s3Backend = {
    getObject({ Key }) {
      return {
        async promise() {
          return { Body: localCache[Key] }
        },
      }
    },
    putObject({ Key, Body }) {
      return {
        async promise() {
          localCache[Key] = Body
          return {
            $response: {
              error: undefined,
            },
          }
        },
      }
    },
  }
  if (isE2E) {
    return S3Store({
      bucket: process.env.SHEPHERD_S3_BUCKET || "shepherd-test-bucket",
    })
  } else {
    return createS3Store(s3Backend)({
      bucket: process.env.SHEPHERD_S3_BUCKET || "shepherd-test-bucket",
    })
  }
})
