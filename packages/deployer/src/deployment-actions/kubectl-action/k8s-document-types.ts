type TK8sHttpBackend = {
  serviceName?: string
  service?: {
    name?: string
  }
}

export type TK8sHttpPath = {
  path: string
  backend: TK8sHttpBackend
}

export type TK8sHttp = {
  paths: Array<TK8sHttpPath>
}

export type TK8sPartialRule = {
  http: TK8sHttp
  host: string
}

export type TK8sPartialConfigmap = {
  name: string
}

export type TK8sPartialSpec = {
  loadBalancerSourceRanges?: {}
  scaleTargetRef?: {
    name: string
  }
  maxReplicas?: number
  minReplicas?: number
  selector?: TK8sPartialDescriptor
  volumes?: Array<{
    configMap: TK8sPartialConfigmap
  }>
  template?: TK8sPartialDescriptor
  jobTemplate?: TK8sPartialDescriptor
  containers?: Array<TK8sPartialContainer>
  replicas?: number
  rules?: Array<TK8sPartialRule>
}

type TK8sPartialLabels = { [index: string]: string | undefined }

type TK8sPartialMetadata = {
  labels?: TK8sPartialLabels
  name?: string
  namespace?: string
  annotations?: { [key: string]: string }
}

export type TK8sPartialDescriptor = {
  resources?: {
    requests: {
      cpu: string
    }
  }
  matchLabels?: TK8sPartialLabels
  origin?: string
  app?: string
  name?: string
  spec: TK8sPartialSpec
  metadata: TK8sPartialMetadata
  kind: string
}

export type TK8sIngressDoc = TK8sPartialDescriptor & {}

export type TK8sPartialContainer = TK8sPartialDescriptor & {
  env: Array<{
    valueFrom: {
      secretKeyRef: {
        name: string
      }
    }
  }>
}
