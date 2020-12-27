import { THerdDeployerMetadata, THerdK8sMetadata } from "../temptypes"
import { TDeployerRole, TDeploymentType } from "@shepherdorg/metadata/dist"

export function getValidHerdDeployerMetadata() {
  const input: THerdDeployerMetadata = {
    environment: [],
    deploymentState: {
      new: false,
      key: "dev-images-plain-deployer",
      modified: true,
      operation: "apply",
      version: "999.999.99999",
      lastVersion: "999.999.99998",
      timestamp: new Date("2019-10-21T14:53:18+00:00"),
      signature: "shasignatureforchangedetection",
      env: "dev",
    },
    deploymentType: TDeploymentType.Deployer,
    herdSpec: {
      key: "images-plain-deployer",
      image: "isrvkbuild02:5000/fluentd",
      imagetag: "v1.1.2-g-2b48d1c",
      description: "Log writer to AWS ES/Kibana",
    },
    buildDate: new Date("2019-10-21T14:53:18+00:00"),
    buildHostName: "Gulaugurs-MacBook-Pro.local",
    dockerImageTag: "plain-deployer-repo:latest",
    migrationImage: "plain-testing-migrationimage",
    // "dockerImageGithash": "plain-deployer-repo:latest-062b591",
    gitHash: "062b591",
    gitBranch: "master",
    gitUrl: "git@github.com:ShepherdOrg/npm-packages.git",
    gitCommit: "2153e378877c0deaa2a3ee2491800d40f5212bc5",
    lastCommits:
      " Sun, 20 Oct 2019 17:55:38 +0000 by Guðlaugur S. Egilsson. --- Metadata updates and a few more fixes. \n\n Wed, 9 Oct 2019 13:52:56 +0000 by Guðlaugur S. Egilsson. --- First pass on shepherd-inspect, not ready at all though. \n\n Mon, 7 Oct 2019 14:28:50 +0000 by Guðlaugur S. Egilsson. --- Adding json schema for validating shepherd.json config file \n\n Fri, 4 Oct 2019 15:00:24 +0000 by Guðlaugur S. Egilsson. --- Introducing npm installable build docker script. Changing docker label for metadata packaging \n",
    semanticVersion: "latest",
    displayName: "Plain shepherd deployer",
    deployerRole: TDeployerRole.Install,
    // "environment": {
    //     "DB_HOST": "MICROSERVICES_POSTGRES_RDS_HOST",
    //     "DB_PASS": "MICRO_SITES_DB_PASSWORD"
    // },
    environmentVariablesExpansionString:
      "DB_HOST=${MICRO_DEPLOYER_DB_PASSWORD}",
    deployCommand: "ls",
    rollbackCommand: "cat",
    hyperlinks: [
      {
        title: "TestlinkOne",
        url: "https://link.to.nowhere",
      },
      {
        title: "TestLinkTwo",
        url: "https://link.to.elsewhere",
      },
    ],
  }
  return {...input}
}
export function getValidHerdK8sMetadata() {
  const input: THerdK8sMetadata = {
    buildDate: new Date("2019-10-29T14:53:42.000Z"),
    buildHostName: "db704622a3b2",
    dockerImageTag: "shepherdorg/shepherd-ui-api:latest",
    // "dockerImageGithash": "shepherdorg/shepherd-ui-api:3.0.3-c481249",
    gitHash: "c481249",
    gitBranch: "master",
    gitUrl: "git@github.com:ShepherdOrg/shepherd-ui.git",
    gitCommit: "c481249b51283043604aecdd2534e11ba7259946",
    lastCommits:
      " Tue, 29 Oct 2019 14:50:13 +0000 by Einar Nordfjord. --- fix port in hasura \n\n Tue, 29 Oct 2019 13:13:08 +0000 by Einar Nordfjord. --- fix prettier \n\n Tue, 29 Oct 2019 13:05:32 +0000 by Einar Nordfjord. --- pretteir format yml \n\n Tue, 29 Oct 2019 12:38:17 +0000 by Einar Nordfjord. --- fix kube yaml \n\n Tue, 29 Oct 2019 11:39:50 +0000 by Einar Nordfjord. --- upgrade shepherd \n",
    semanticVersion: "3.0.3",
    // "kubeConfigB64": "H4sIAHZSuF0AA+1WzXPiNhTnzF/xZnpIdyY2EDCb+sYGL8kMJRRIpj0xsv0AFSG5kgzL7Oz/XskYYrNh4bA7bad5B/Dz+/7QT3ZrMSZMbFfIda3yY6hu6L3n2f+2590U//dUaTQ9r133Go12u1I3TLNRAe8H5VOiVGkiASoRlRHDiJ7SOyf/j5JbnP8yDdHdkhX7vjHsgNut1qn5t7yb5tH8vWbrfQXq3zeN1+l/Pn+S0GeUigruw7pRXVIe+zBGuaYRVleoSUw08asAnKzQB7XAZIEydlLqGFNH5ZoAjITIlNU8rwuAfE2l4HbrfPj8ORg8f/lSVQlG1kEipM49ORnjw20dfgK9wIw1D8T+UAW5TxNLpCzOWATBM1vITSLBNaEcpREAkmhhnMSghRVwjIwncQ0R4RAikCz3g/nP6M5duNpsNlfvQEgrTleh8bQT3Nbf5ap5xbtsbI75e7Nbc9TDvIbbev46kUKLSDAfJnfDqo30p9lDYHSJWcoKzappE5DyjJfmjNKIaDOmrBwpGEN5nVmGad4LTVcIVAONTVfpjKLKfWkQM1uzskUzQWIICSM8G4VpkSSzGY2MzDX8PvKu/SRJTs7RMR5Pz9JxnGpxt/CTRm4fVW3dCM1e7Xete4Cfy9fNecEso0o4FzrrTb40FsYkR43KpaIWLQifoxORVKHNb9LpTQedX4PCwuXtVT40DKdxlTCiceesmJSl4p5f3KKTbbKCfRaWDrtaiOCcaUYxCABdkXlBWch57cjQb7p1t+lErdvGTeuXY9NhythQmHZsfeiwDdmqgoapwS+wL7ndd8ZPo860N+oM73/rT7udSedDZxxMn0b9kj7AmrA0m8P4PhjeB6Pu9OlhOnwcT3qjYGz1866ciRAMOh/6wfTucTB+7Aevx7jSMsWry711p/3H3nTyxzAYv+7QXhU6Ta5hoXXiMDG/hg2GCyGWB0aJaIl6x/6Votzax4K3Ara95HSY+ldAsacSvjgFgLHE6Bo5KjWUIsSyb5toD7V/5C4heuFD7fhtFv1EELMenGpKWBcZ2Y7R5BzbA+OVdCwGiVQfxK2SdEYoSyVOFhINYDNz+m9K8gQlFfHBuFnsgkQS039tlRfD3QOfm+LVBVhns3dorr5TUgmJjGaMM5IyfXTpfguIXkNJPqf8k5sHcMuYKXEjqUZnd33ZHh6gMmV4uJsXQhkhNYHMcQ5Gzw93wXT89PHjw++HQ2xH8zIXW1Np+539kI4SL7U7JOZMmeYdDTKvbXD2Y+Mrk/0xs2DPStWUYPebhSmMJOpB8VwqJ0KzTf/0J90bvdEbvdFF9DfTFUkVABIAAA==",
    displayName: "Shepherd UI API",
    hyperlinks: [
      {
        title: "Git repository",
        url: "https://github.com/shepherdorg/shepherd-ui/",
      },
      {
        title: "Build",
        url: "https://circleci.com/gh/ShepherdOrg/shepherd-ui/",
      },
    ],
    deploymentType: TDeploymentType.Kubernetes, // "k8s",
    kubeDeploymentFiles: {
      "./deployment/kube.yaml": {
        path: "./deployment/kube.yaml",
        content:
          "apiVersion: v1\nkind: Service\nmetadata:\n  name: shepherd-ui-api-service\n  labels:\n    name: shepherd-ui-api-service\n    environment: {{ENV}}\nspec:\n  ports:\n    - port: 80 # the port that this service should serve on\n      # the container on each pod to connect to, can be a name\n      # (e.g. 'www') or a number (e.g. 80)\n      name: serviceport\n      targetPort: 8080\n      protocol: TCP\n  # just like the selector in the replication controller,\n  # but this time it identifies the set of pods to load balance\n  # traffic to.\n  selector:\n    app: shepherd-ui-api-service-pod\n    environment: {{ENV}}\n---\napiVersion: extensions/v1beta1\nkind: Deployment\nmetadata:\n  name: shepherd-ui-api-service-deployment\n  annotations:\n    kubernetes.io/change-cause: {{TAG_NAME}}\nspec:\n  replicas: 1\n  template:\n    metadata:\n      labels:\n        app: shepherd-ui-api-service-pod\n        environment: {{ENV}}\n    spec:\n      containers:\n        - name: shepherd-ui-api-service-pod\n          image: shepherdorg/shepherd-ui-api:3.0.3-c481249\n          imagePullPolicy: Always\n          env:\n            - name: HASURA_GRAPHQL_DATABASE_URL\n              value: {{SHEPHERD_UI_POSTGRES_URL}}\n            - name: HASURA_GRAPHQL_ENABLE_CONSOLE\n              value: 'true'\n            - name: HASURA_GRAPHQL_ENABLED_LOG_TYPES\n              value: startup, http-log, webhook-log, websocket-log, query-log\n          ports:\n            - containerPort: 8080\n              name: service-port\n          livenessProbe:\n            httpGet:\n              path: /\n              port: service-port\n            initialDelaySeconds: 15\n            timeoutSeconds: 4\n            failureThreshold: 2\n            periodSeconds: 30\n          readinessProbe:\n            httpGet:\n              path: /\n              port: service-port\n            initialDelaySeconds: 15\n            timeoutSeconds: 4\n---\napiVersion: extensions/v1beta1\nkind: Ingress\nmetadata:\n  name: shepherd-ui-api-path-ingress\n  namespace: default\n  labels:\n    app: shepherd-ui-api-service\n  annotations:\n    nginx.ingress.kubernetes.io/rewrite-target: /\nspec:\n  rules:\n    - host: iapi.dev.it.tm.is\n      http:\n        paths:\n          - path: /shepherd-ui-api\n            backend:\n              serviceName: shepherd-ui-api-service\n              servicePort: 80\n  tls:\n    - hosts:\n        - iapi.dev.it.tm.is\n      secretName: services-cert\n",
      },
    },
    deploymentState: {
      timestamp: new Date("2019-10-31T14:05:52.716Z"),
      key: "dev-Service_shepherd-ui-api-service",
      new: true,
      modified: true,
      operation: "apply",
      version: "3.0.3-c481249",
      signature: "4490ea1847ec8850781d0925e1d77f73",
      env: "dev",
    },
    herdSpec: {
      image: "shepherdorg/shepherd-ui-api",
      imagetag: "3.0.3-c481249",
      description: "Shepherd web UI API",
      // "herdKey": "shepherd-ui-api",
      key: "shepherd-ui-api",
    },
  }

  return {...input}
}
