export function deploymentData0(): any {
  return {
    "herdSpec": {
      "image": "shepherdorg/shepherd-ui-api",
      "imagetag": "3.0.3-c481249",
      "description": "Shepherd web UI API",
      "herdKey": "shepherd-ui-api",
    },
    "metadata": {
      "buildDate": "2019-10-29T14:53:42+00:00",
      "buildHostName": "db704622a3b2",
      "dockerImageTag": "shepherdorg/shepherd-ui-api:latest",
      "dockerImageGithash": "shepherdorg/shepherd-ui-api:3.0.3-c481249",
      "gitHash": "c481249",
      "gitBranch": "master",
      "gitUrl": "git@github.com:ShepherdOrg/shepherd-ui.git",
      "gitCommit": "c481249b51283043604aecdd2534e11ba7259946",
      "lastCommits": " Tue, 29 Oct 2019 14:50:13 +0000 by Einar Nordfjord. --- fix port in hasura \n\n Tue, 29 Oct 2019 13:13:08 +0000 by Einar Nordfjord. --- fix prettier \n\n Tue, 29 Oct 2019 13:05:32 +0000 by Einar Nordfjord. --- pretteir format yml \n\n Tue, 29 Oct 2019 12:38:17 +0000 by Einar Nordfjord. --- fix kube yaml \n\n Tue, 29 Oct 2019 11:39:50 +0000 by Einar Nordfjord. --- upgrade shepherd \n",
      "semanticVersion": "3.0.3",
      "kubeConfigB64": "H4sIAHZSuF0AA+1WzXPiNhTnzF/xZnpIdyY2EDCb+sYGL8kMJRRIpj0xsv0AFSG5kgzL7Oz/XskYYrNh4bA7bad5B/Dz+/7QT3ZrMSZMbFfIda3yY6hu6L3n2f+2590U//dUaTQ9r133Go12u1I3TLNRAe8H5VOiVGkiASoRlRHDiJ7SOyf/j5JbnP8yDdHdkhX7vjHsgNut1qn5t7yb5tH8vWbrfQXq3zeN1+l/Pn+S0GeUigruw7pRXVIe+zBGuaYRVleoSUw08asAnKzQB7XAZIEydlLqGFNH5ZoAjITIlNU8rwuAfE2l4HbrfPj8ORg8f/lSVQlG1kEipM49ORnjw20dfgK9wIw1D8T+UAW5TxNLpCzOWATBM1vITSLBNaEcpREAkmhhnMSghRVwjIwncQ0R4RAikCz3g/nP6M5duNpsNlfvQEgrTleh8bQT3Nbf5ap5xbtsbI75e7Nbc9TDvIbbev46kUKLSDAfJnfDqo30p9lDYHSJWcoKzappE5DyjJfmjNKIaDOmrBwpGEN5nVmGad4LTVcIVAONTVfpjKLKfWkQM1uzskUzQWIICSM8G4VpkSSzGY2MzDX8PvKu/SRJTs7RMR5Pz9JxnGpxt/CTRm4fVW3dCM1e7Xete4Cfy9fNecEso0o4FzrrTb40FsYkR43KpaIWLQifoxORVKHNb9LpTQedX4PCwuXtVT40DKdxlTCiceesmJSl4p5f3KKTbbKCfRaWDrtaiOCcaUYxCABdkXlBWch57cjQb7p1t+lErdvGTeuXY9NhythQmHZsfeiwDdmqgoapwS+wL7ndd8ZPo860N+oM73/rT7udSedDZxxMn0b9kj7AmrA0m8P4PhjeB6Pu9OlhOnwcT3qjYGz1866ciRAMOh/6wfTucTB+7Aevx7jSMsWry711p/3H3nTyxzAYv+7QXhU6Ta5hoXXiMDG/hg2GCyGWB0aJaIl6x/6Votzax4K3Ara95HSY+ldAsacSvjgFgLHE6Bo5KjWUIsSyb5toD7V/5C4heuFD7fhtFv1EELMenGpKWBcZ2Y7R5BzbA+OVdCwGiVQfxK2SdEYoSyVOFhINYDNz+m9K8gQlFfHBuFnsgkQS039tlRfD3QOfm+LVBVhns3dorr5TUgmJjGaMM5IyfXTpfguIXkNJPqf8k5sHcMuYKXEjqUZnd33ZHh6gMmV4uJsXQhkhNYHMcQ5Gzw93wXT89PHjw++HQ2xH8zIXW1Np+539kI4SL7U7JOZMmeYdDTKvbXD2Y+Mrk/0xs2DPStWUYPebhSmMJOpB8VwqJ0KzTf/0J90bvdEbvdFF9DfTFUkVABIAAA==",
      "displayName": "Shepherd UI API",
      "hyperlinks": [{
        "title": "Git repository",
        "url": "https://github.com/shepherdorg/shepherd-ui/",
      }, { "title": "Build", "url": "https://circleci.com/gh/ShepherdOrg/shepherd-ui/" }],
      "deploymentType": "k8s",
      "kubeDeploymentFiles": {
        "./deployment/": { "path": "./deployment/", "content": "" },
        "./deployment/kube.yaml": {
          "path": "./deployment/kube.yaml",
          "content": "apiVersion: v1\nkind: Service\nmetadata:\n  name: shepherd-ui-api-service\n  labels:\n    name: shepherd-ui-api-service\n    environment: {{ENV}}\nspec:\n  ports:\n    - port: 80 # the port that this service should serve on\n      # the container on each pod to connect to, can be a name\n      # (e.g. 'www') or a number (e.g. 80)\n      name: serviceport\n      targetPort: 8080\n      protocol: TCP\n  # just like the selector in the replication controller,\n  # but this time it identifies the set of pods to load balance\n  # traffic to.\n  selector:\n    app: shepherd-ui-api-service-pod\n    environment: {{ENV}}\n---\napiVersion: extensions/v1beta1\nkind: Deployment\nmetadata:\n  name: shepherd-ui-api-service-deployment\n  annotations:\n    kubernetes.io/change-cause: {{TAG_NAME}}\nspec:\n  replicas: 1\n  template:\n    metadata:\n      labels:\n        app: shepherd-ui-api-service-pod\n        environment: {{ENV}}\n    spec:\n      containers:\n        - name: shepherd-ui-api-service-pod\n          image: shepherdorg/shepherd-ui-api:3.0.3-c481249\n          imagePullPolicy: Always\n          env:\n            - name: HASURA_GRAPHQL_DATABASE_URL\n              value: {{SHEPHERD_UI_POSTGRES_URL}}\n            - name: HASURA_GRAPHQL_ENABLE_CONSOLE\n              value: 'true'\n            - name: HASURA_GRAPHQL_ENABLED_LOG_TYPES\n              value: startup, http-log, webhook-log, websocket-log, query-log\n          ports:\n            - containerPort: 8080\n              name: service-port\n          livenessProbe:\n            httpGet:\n              path: /\n              port: service-port\n            initialDelaySeconds: 15\n            timeoutSeconds: 4\n            failureThreshold: 2\n            periodSeconds: 30\n          readinessProbe:\n            httpGet:\n              path: /\n              port: service-port\n            initialDelaySeconds: 15\n            timeoutSeconds: 4\n---\napiVersion: extensions/v1beta1\nkind: Ingress\nmetadata:\n  name: shepherd-ui-api-path-ingress\n  namespace: default\n  labels:\n    app: shepherd-ui-api-service\n  annotations:\n    nginx.ingress.kubernetes.io/rewrite-target: /\nspec:\n  rules:\n    - host: iapi{{SERVICE_SUFFIX}}\n      http:\n        paths:\n          - path: /shepherd-ui-api\n            backend:\n              serviceName: shepherd-ui-api-service\n              servicePort: 80\n  tls:\n    - hosts:\n        - iapi{{SERVICE_SUFFIX}}\n      secretName: services-cert\n",
        },
      },
    },
    "operation": "apply",
    "identifier": "Service_shepherd-ui-api-service",
    "version": "3.0.3-c481249",
    "descriptor": "apiVersion: v1\nkind: Service\nmetadata:\n  name: shepherd-ui-api-service\n  labels:\n    name: shepherd-ui-api-service\n    environment: dev\nspec:\n  ports:\n    - port: 80 # the port that this service should serve on\n      # the container on each pod to connect to, can be a name\n      # (e.g. 'www') or a number (e.g. 80)\n      name: serviceport\n      targetPort: 8080\n      protocol: TCP\n  # just like the selector in the replication controller,\n  # but this time it identifies the set of pods to load balance\n  # traffic to.\n  selector:\n    app: shepherd-ui-api-service-pod\n    environment: dev\n---\napiVersion: extensions/v1beta1\nkind: Deployment\nmetadata:\n  name: shepherd-ui-api-service-deployment\n  annotations:\n    kubernetes.io/change-cause: forShepherdUi\nspec:\n  replicas: 1\n  template:\n    metadata:\n      labels:\n        app: shepherd-ui-api-service-pod\n        environment: dev\n    spec:\n      containers:\n        - name: shepherd-ui-api-service-pod\n          image: shepherdorg/shepherd-ui-api:3.0.3-c481249\n          imagePullPolicy: Always\n          env:\n            - name: HASURA_GRAPHQL_DATABASE_URL\n              value: postgres://:@isrvkbuild02:5432/postgres\n            - name: HASURA_GRAPHQL_ENABLE_CONSOLE\n              value: 'true'\n            - name: HASURA_GRAPHQL_ENABLED_LOG_TYPES\n              value: startup, http-log, webhook-log, websocket-log, query-log\n          ports:\n            - containerPort: 8080\n              name: service-port\n          livenessProbe:\n            httpGet:\n              path: /\n              port: service-port\n            initialDelaySeconds: 15\n            timeoutSeconds: 4\n            failureThreshold: 2\n            periodSeconds: 30\n          readinessProbe:\n            httpGet:\n              path: /\n              port: service-port\n            initialDelaySeconds: 15\n            timeoutSeconds: 4\n---\napiVersion: extensions/v1beta1\nkind: Ingress\nmetadata:\n  name: shepherd-ui-api-path-ingress\n  namespace: default\n  labels:\n    app: shepherd-ui-api-service\n  annotations:\n    nginx.ingress.kubernetes.io/rewrite-target: /\nspec:\n  rules:\n    - host: iapi.dev.it.tm.is\n      http:\n        paths:\n          - path: /shepherd-ui-api\n            backend:\n              serviceName: shepherd-ui-api-service\n              servicePort: 80\n  tls:\n    - hosts:\n        - iapi.dev.it.tm.is\n      secretName: services-cert\n",
    "origin": "shepherdorg/shepherd-ui-api:3.0.3-c481249:kube.config.tar.base64",
    "type": "k8s",
    "fileName": "./deployment/kube.yaml",
    "env": "dev",
    "state": {
      "timestamp": "2019-10-31T14:05:52.716Z",
      "key": "dev-Service_shepherd-ui-api-service",
      "new": true,
      "modified": true,
      "operation": "apply",
      "version": "3.0.3-c481249",
      "signature": "4490ea1847ec8850781d0925e1d77f73",
      "env": "dev",
    },
  }
}


export function deploymentData1() {

  return {
    "herdSpec": {
      "image": "shepherdorg/shepherd-ui",
      "imagetag": "3.0.3-8d75408",
      "description": "Shepherd Web UI",
      "herdKey": "shepherd-ui",
    },
    "metadata": {
      "buildDate": "2019-10-29T15:16:31+00:00",
      "buildHostName": "fb7bee96cc25",
      "dockerImageTag": "shepherdorg/shepherd-ui:latest",
      "dockerImageGithash": "shepherdorg/shepherd-ui:3.0.3-8d75408",
      "gitHash": "8d75408",
      "gitBranch": "master",
      "gitUrl": "git@github.com:ShepherdOrg/shepherd-ui.git",
      "gitCommit": "8d754086175c386b5f4832853c76b0c8e6bf5219",
      "lastCommits": " Tue, 29 Oct 2019 15:13:30 +0000 by Einar Nordfjord. --- fix env in next container \n\n Tue, 29 Oct 2019 13:13:08 +0000 by Einar Nordfjord. --- fix prettier \n\n Tue, 29 Oct 2019 13:05:32 +0000 by Einar Nordfjord. --- pretteir format yml \n\n Tue, 29 Oct 2019 12:38:17 +0000 by Einar Nordfjord. --- fix kube yaml \n\n Tue, 29 Oct 2019 11:55:25 +0000 by Einar Nordfjord. --- correct casing in package json \n",
      "semanticVersion": "3.0.3",
      "kubeConfigB64": "H4sIAM9XuF0AA+1W3W/aSBDnmb9ipD6kleoPCk4iv6GG9iLdURSS6N6ixR7wNsuub3cNRVH+9846BmwScjw0ujsd8wCs5/s3vx3jBynmQq3mKG3QehsJSc6iyH2fRtGn+vdaWp1uFJ2GUfesc9YK6dCNWhC9UT0NKYxlGqCVcJ0ITPg+u7/T/0fFr8//vpigv2Jz8WtzuAGf9nr75t8Le92d+dP4wxaEv7aMl+V/Pn+W81vUhisZw6LTvucyjWGMesETbM/RspRZFrcBJJtjDCbDPEOdegX3TGUFINgEhXFWr9sBoFxwraRjWwwPD4Ph7eNj2+SYOOdcaVtF8cpDDOchvAObYXmkH8x9cANVTMqjCpGWRwQlS1+oXBIlLeMSNSkAWZJRkBSscgqJCUVSHyFhEiYIrKx74/4e/ZkPJ8vl8uQDKO3UxXxCkZ4U5+GHyrTq9qkaV2P1nDg1Qzsqe+gSx6vHuVZWJUrEcP151HaZvhP/QPB7LEs2SBSzlJDL8qzpbvKEWRpP2Y5WQqD+WHpOigoLy+cI3AJPCVU+5WiqWBbU1PVsXNNCsRQmTDBZjoIg0mw65QnpfDqvMz/Bz/L8xRl6FG3/HD3Pa9f5hD8sSvfTBIvOhLi05tfFZuUcRjFvu6PIjEmpbIlJRRa3trREi8bnKkgyJmfoJaww6Gq77n+9G/b/GNSIVsFqYujQyeI8F8ziU7B6QU7q3D4Imr3wOMW6Aicbftaie6+AUE8AwOdsVjNUehbUnOKuH/pd7zw9i3rh+a7bqBBipAiCVQx9sWQrU7Og2uPacVvTb/3xzVX/bjC8GH27HF7f3Vz93rADWDBRkOHSmDgIOFHh4WE8uLq9/Dy4G998+XL55+NjvUiPLIgZwUyzPPtL1ILVNsG2ig1ez67VWhq30atdx3KQfIESjRlpNcFm7Mza/CvaeCdczmwWQ7D7tMy+JwkBLLnlTFygYKsxUs2po1nUsHE3VhV2o+41tFPGRaHxOtNI603QffnU0OeouUo3zt06ChpZyv+1XR68IC7ljJo3B24HXlm/sBrkjMsffmXgNxeFMcLTmHJNiy+GkykTBk+2O6IQuHkZZcrYRu7nxG5vQd4i7LBt8NijFZzcI/W4g3fVy/DVt+cz81H1knRbTDSqbeyUQwo3mGi0w/oNMl6CNPd/+i/KUY5ylKMc5Q3kJzBR158AEgAA",
      "displayName": "Shepherd UI",
      "hyperlinks": [{
        "title": "Git repository",
        "url": "https://github.com/shepherdorg/shepherd-ui/",
      }, { "title": "Build", "url": "https://circleci.com/gh/ShepherdOrg/shepherd-ui/" }],
      "deploymentType": "k8s",
      "kubeDeploymentFiles": {
        "./deployment/": { "path": "./deployment/", "content": "" },
        "./deployment/kube.yaml": {
          "path": "./deployment/kube.yaml",
          "content": "apiVersion: v1\nkind: Service\nmetadata:\n  name: shepherd-ui-service\n  labels:\n    name: shepherd-ui-service\n    environment: {{ENV}}\nspec:\n  ports:\n    - port: 80 # the port that this service should serve on\n      # the container on each pod to connect to, can be a name\n      # (e.g. 'www') or a number (e.g. 80)\n      name: serviceport\n      targetPort: 3000\n      protocol: TCP\n  # just like the selector in the replication controller,\n  # but this time it identifies the set of pods to load balance\n  # traffic to.\n  selector:\n    app: shepherd-ui-service-pod\n    environment: {{ENV}}\n---\napiVersion: extensions/v1beta1\nkind: Deployment\nmetadata:\n  name: shepherd-ui-service-deployment\n  annotations:\n    kubernetes.io/change-cause: {{TAG_NAME}}\nspec:\n  replicas: 1\n  template:\n    metadata:\n      labels:\n        app: shepherd-ui-service-pod\n        environment: {{ENV}}\n    spec:\n      containers:\n        - name: shepherd-ui-service-pod\n          image: shepherdorg/shepherd-ui:3.0.3-8d75408\n          imagePullPolicy: Always\n          env:\n            - name: HASURA_ENDPOINT_URL\n              value: wss://iapi{{SERVICE_SUFFIX}}/shepherd-ui-api/v1/graphql\n          ports:\n            - containerPort: 3000\n              name: service-port\n          livenessProbe:\n            httpGet:\n              path: /\n              port: service-port\n            initialDelaySeconds: 15\n            timeoutSeconds: 4\n            failureThreshold: 2\n            periodSeconds: 30\n          readinessProbe:\n            httpGet:\n              path: /\n              port: service-port\n            initialDelaySeconds: 15\n            timeoutSeconds: 4\n---\napiVersion: extensions/v1beta1\nkind: Ingress\nmetadata:\n  name: shepherd-ui-service-ingress\n  annotations:\n    nginx.ingress.kubernetes.io/ssl-redirect: 'false'\nspec:\n  rules:\n    - host: shepherd-ui{{SERVICE_SUFFIX}}\n      http:\n        paths:\n          - backend:\n              serviceName: shepherd-ui-service\n              servicePort: 80\n  tls:\n    - hosts:\n        - shepherd-ui{{SERVICE_SUFFIX}}\n      secretName: services-cert\n",
        },
      },
    },
    "operation": "apply",
    "identifier": "Service_shepherd-ui-service",
    "version": "3.0.3-8d75408",
    "descriptor": "apiVersion: v1\nkind: Service\nmetadata:\n  name: shepherd-ui-service\n  labels:\n    name: shepherd-ui-service\n    environment: dev\nspec:\n  ports:\n    - port: 80 # the port that this service should serve on\n      # the container on each pod to connect to, can be a name\n      # (e.g. 'www') or a number (e.g. 80)\n      name: serviceport\n      targetPort: 3000\n      protocol: TCP\n  # just like the selector in the replication controller,\n  # but this time it identifies the set of pods to load balance\n  # traffic to.\n  selector:\n    app: shepherd-ui-service-pod\n    environment: dev\n---\napiVersion: extensions/v1beta1\nkind: Deployment\nmetadata:\n  name: shepherd-ui-service-deployment\n  annotations:\n    kubernetes.io/change-cause: forShepherdUi\nspec:\n  replicas: 1\n  template:\n    metadata:\n      labels:\n        app: shepherd-ui-service-pod\n        environment: dev\n    spec:\n      containers:\n        - name: shepherd-ui-service-pod\n          image: shepherdorg/shepherd-ui:3.0.3-8d75408\n          imagePullPolicy: Always\n          env:\n            - name: HASURA_ENDPOINT_URL\n              value: wss://iapi.dev.it.tm.is/shepherd-ui-api/v1/graphql\n          ports:\n            - containerPort: 3000\n              name: service-port\n          livenessProbe:\n            httpGet:\n              path: /\n              port: service-port\n            initialDelaySeconds: 15\n            timeoutSeconds: 4\n            failureThreshold: 2\n            periodSeconds: 30\n          readinessProbe:\n            httpGet:\n              path: /\n              port: service-port\n            initialDelaySeconds: 15\n            timeoutSeconds: 4\n---\napiVersion: extensions/v1beta1\nkind: Ingress\nmetadata:\n  name: shepherd-ui-service-ingress\n  annotations:\n    nginx.ingress.kubernetes.io/ssl-redirect: 'false'\nspec:\n  rules:\n    - host: shepherd-ui.dev.it.tm.is\n      http:\n        paths:\n          - backend:\n              serviceName: shepherd-ui-service\n              servicePort: 80\n  tls:\n    - hosts:\n        - shepherd-ui.dev.it.tm.is\n      secretName: services-cert\n",
    "origin": "shepherdorg/shepherd-ui:3.0.3-8d75408:kube.config.tar.base64",
    "type": "k8s",
    "fileName": "./deployment/kube.yaml",
    "herdKey": "shepherd-ui",
    "env": "dev",
    "state": {
      "timestamp": "2019-10-31T15:36:25.956Z",
      "key": "dev-Service_shepherd-ui-service",
      "new": true,
      "modified": true,
      "operation": "apply",
      "version": "3.0.3-8d75408",
      "signature": "472322c354c54377186d511e9bd320d9",
      "env": "dev",
    },
  }
}
