// Small inline GraphQL client for pushing deployment metadata to the Shepherd
// UI Hasura endpoint. Replaces @shepherdorg/ui-graphql-client so we don't pull
// in node-fetch / @types/node-fetch / form-data transitively.

// Minimal ambient declarations so this compiles on the package's pinned
// @types/node@12 (which predates Node's global fetch). Node 18+ at runtime
// provides the actual implementation.
type FetchHeaders = { [key: string]: string }

interface FetchRequestInit {
  method?: string
  headers?: FetchHeaders
  body?: string
}

interface FetchResponse {
  json(): Promise<any>
}

declare const fetch: (
  input: string,
  init?: FetchRequestInit,
) => Promise<FetchResponse>

export interface Hyperlink {
  url: string
  title: string
}

export interface ConfigurationItem {
  key: string
  value: string
  isSecret: boolean
}

export interface KubernetesFile {
  path: string
  content: string
}

export interface Deployment {
  id: string
  herd_key?: string
  display_name?: string
  description?: string
  deployment_type?: string
  deployer_role?: string
  db_migration_image?: string
  env?: string
  last_deployment_timestamp?: string
  last_deployment_version?: string
  hyperlinks?: Hyperlink[]
}

export interface DeploymentVersion {
  id: string
  deployment_id?: string
  build_host_name?: string
  built_at?: string
  deployed_at?: string
  docker_image?: string
  docker_image_tag?: string
  env?: string
  git_branch?: string
  git_commit?: string
  git_hash?: string
  git_url?: string
  last_commits?: string
  time_to_live?: number
  version?: string
  hyperlinks?: Hyperlink[]
  configuration?: ConfigurationItem[]
  kubernetes_deployment_files?: KubernetesFile[]
}

interface QueryBody {
  query: string
  variables?: { [key: string]: any }
}

export interface HasuraError {
  message: string
  extensions?: any
}

export interface GqlResponse<T> {
  data?: T
  errors?: ReadonlyArray<HasuraError>
}

export interface Options {
  fetchInit?: FetchRequestInit
  logger?: typeof console
}

const upsertDeploymentMutation = `
  mutation InsertDeployment($input: [deployments_insert_input!]!) {
    insert_deployments(objects: $input, on_conflict: {
      constraint: deployments_pkey,
      update_columns: [
        db_migration_image,
        deployer_role,
        deployment_type,
        description,
        display_name,
        env,
        hyperlinks,
        last_deployment_timestamp
        last_deployment_version
      ]})
    {
      affected_rows
      returning {
        id
      }
    }
  }
`

const upsertDeploymentVersionMutation = `
  mutation InsertDeploymentVersion(
    $input: [deployment_versions_insert_input!]!
  ) {
    insert_deployment_versions(
      objects: $input
      on_conflict: {
        constraint: deployment_versions_pkey
        update_columns: [
          build_host_name
          built_at
          configuration
          deployed_at
          deployment_id
          docker_image
          docker_image_tag
          env
          git_branch
          git_commit
          git_hash
          git_url
          id
          kubernetes_deployment_files
          last_commits
          version
        ]
      }
    ) {
      affected_rows
      returning {
        id
      }
    }
  }
`

function rejectOnErrors<T>(operationContext: string) {
  return (response: GqlResponse<T>): GqlResponse<T> => {
    if (response.errors && response.errors.length) {
      const joinedMessage = response.errors.map(e => e.message).join("\n")
      throw new Error(`In ${operationContext}: ${joinedMessage}`)
    }
    return response
  }
}

export function createClient(apiUrl: string, options: Options = {}) {
  const { logger = console, fetchInit = {} } = options

  if (typeof fetch !== "function") {
    throw new Error(
      "Global fetch is not available. @shepherdorg/ui-push requires Node 18+.",
    )
  }

  async function runQuery<T>(
    body: QueryBody,
    queryContext: string,
  ): Promise<GqlResponse<T>> {
    const response = await fetch(apiUrl, {
      ...fetchInit,
      method: "POST",
      headers: {
        ...(fetchInit.headers || {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    const json = (await response.json()) as GqlResponse<T>
    logger.debug("Query response:", JSON.stringify(json))
    return rejectOnErrors<T>(queryContext)(json)
  }

  function upsert<T>(query: string, queryContext: string) {
    return (input: unknown): Promise<GqlResponse<T>> =>
      runQuery<T>({ query, variables: { input } }, queryContext)
  }

  return {
    upsertDeployment: upsert<unknown>(upsertDeploymentMutation, "upsert deployment"),
    upsertDeploymentVersion: upsert<unknown>(
      upsertDeploymentVersionMutation,
      "upsert deployment version",
    ),
  }
}
