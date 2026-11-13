import { IStorageBackend } from "@shepherdorg/state-store"

import { GetObjectCommand, PutObjectCommand, S3Client as AwsS3Client } from "@aws-sdk/client-s3"

interface S3StoreConfig {
  bucket: string
  prefix?: string
}

interface S3Client {
  getObject(options: {
    Key: string
    Bucket: string
  }): Promise<{ Body?: { transformToString(): Promise<string> } | string | Buffer | undefined }>
  putObject(options: {
    Key: string
    Bucket: string
    Body: string
    ContentType: string
  }): Promise<unknown>
}

function createAwsS3Client(): S3Client {
  const client = new AwsS3Client({})
  return {
    getObject: options => client.send(new GetObjectCommand(options)),
    putObject: options => client.send(new PutObjectCommand(options)),
  }
}

async function bodyToString(body: any): Promise<string> {
  if (typeof body === "string") {
    return body
  }
  if (body && typeof body.transformToString === "function") {
    return body.transformToString()
  }
  return body.toString()
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
          const result = await s3Client.getObject({
            Key: `${prefix}${key}`,
            Bucket: bucket,
          })
          if (result.Body) {
            const value = JSON.parse(await bodyToString(result.Body))
            return { key, value }
          } else {
            return { key, value: undefined }
          }
        } catch (err) {
          return { key, value: undefined }
        }
      },
      async set(key, value) {
        // The v3 SDK rejects on failure, so errors propagate to the caller.
        await s3Client.putObject({
          Key: `${prefix}${key}`,
          Bucket: bucket,
          Body: JSON.stringify(value),
          ContentType: "application/json",
        })

        return { key, value }
      },
    }
  }

export const S3Store = (config: S3StoreConfig) => createS3Store(createAwsS3Client())(config)
