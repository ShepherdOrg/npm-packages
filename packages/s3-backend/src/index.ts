import { IStorageBackend } from "@shepherdorg/state-store"

import AWS from "aws-sdk"

const s3Client = new AWS.S3()

interface S3StoreConfig {
  bucket: string
  prefix?: string
}

interface S3Client {
  getObject(options: {
    Key: string
    Bucket: string
  }): { promise(): Promise<{ Body: string | Buffer | undefined }> }
  putObject(options: {
    Key: string
    Bucket: string
    Body: string
    ContentType: string
  }): { promise(): Promise<{ $response: { error?: AWS.AWSError } }> }
}

export const createS3Store = (s3Client: S3Client) =>
  function S3Store({ bucket, prefix = "" }: S3StoreConfig): IStorageBackend {
    return {
      async connect() {
        // this is a noop in this implementation
        return
      },
      async disconnect() {
        // This is a noop in this implementation.
        return
      },
      async get(key) {
        try {
          const result = await s3Client
            .getObject({
              Key: `${prefix}${key}`,
              Bucket: bucket,
            })
            .promise()
          if (result.Body) {
            const value = JSON.parse(result.Body.toString())
            return { key, value }
          } else {
            return { key, value: undefined }
          }
        } catch (err) {
          return { key, value: undefined }
        }
      },
      async set(key, value) {
        const result = await s3Client
          .putObject({
            Key: `${prefix}${key}`,
            Bucket: bucket,
            Body: JSON.stringify(value),
            ContentType: "application/json",
          })
          .promise()

        if (result.$response.error) {
          throw result.$response.error
        }

        return { key, value }
      },
    }
  }

export const S3Store = createS3Store(s3Client as S3Client)
