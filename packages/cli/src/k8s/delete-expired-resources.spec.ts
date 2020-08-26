import { kubeDeleteExpiredResources } from "./delete-expired-resources"
import { expect } from "chai"


describe.only("resource filtering", function() {

  const testData = {
    "apiVersion": "v1",
    items: [{
      "apiVersion": "v1",
      "kind": "Service",
      "metadata": {
        "creationTimestamp": "2019-10-22T13:29:56Z",
        "name": "myservice-internal-expired-service",
        "labels": {
          "name": "myservice-internal-expired-service",
          "ttl-hours": "120",
        },
      },
      "spec": {
        "ports": [
          {
            "port": 10000,
            "name": "http",
          },
        ],
        "selector": {
          "name": "myservice-expired-service",
          "tier": "frontend",
        },
      },
    }, {
      "apiVersion": "v1",
      "kind": "Service",
      "metadata": {
        "creationTimestamp": "2019-11-06T13:29:56Z",
        "name": "myservice-internal-valid-service",
        "labels": {
          "name": "myservice-internal-valid-service",
          "ttl-hours": "120",
        },
      },
      "spec": {
        "ports": [
          {
            "port": 10000,
            "name": "http",
          },
        ],
        "selector": {
          "name": "myservice-valid-service",
          "tier": "frontend",
        },
      },
    }, {
      "apiVersion": "v1",
      "kind": "Service",
      "metadata": {
        "creationTimestamp": "2019-11-06T13:29:56Z",
        "name": "myservice-internal-regular-service",
        "labels": {
          "name": "myservice-internal-regular-service",
        },
      },
      "spec": {
        "ports": [
          {
            "port": 10000,
            "name": "http",
          },
        ],
        "selector": {
          "name": "myservice-regular-service",
          "tier": "frontend",
        },
      },
    },
    ],
  }

  it("should create dryrun commands testService", () => {
    const logentries: Array<String> = []
    const logger = {
      log: (logentry: string) => {
        logentries.push(logentry)
      },
    }
    kubeDeleteExpiredResources(testData, logger, true, new Date("2019-11-06T13:29:56Z").getTime())
    expect(logentries.length).to.equal(1)
    expect(logentries[0]).to.equal("echo DRYRUN kubectl delete service myservice-internal-expired-service")
  })

  it("should create delete commands testService", () => {
    const deleteCommands: Array<String> = []
    const logger = {
      log: (logentry: string) => {
        deleteCommands.push(logentry)
      },
    }
    kubeDeleteExpiredResources(testData, logger, false, new Date("2019-11-06T13:29:56Z").getTime())
    expect(deleteCommands.length).to.equal(1)
    expect(deleteCommands[0]).to.equal("kubectl delete service myservice-internal-expired-service")
  })

  it("should create delete command based on lastDeploymentStamp", () => {

    const localTestData ={
      "apiVersion": "v1",
      items:

        [{
          "apiVersion": "v1",
          "kind": "Ingress",
          "metadata": {
            "creationTimestamp": "2020-08-01T13:29:56Z",
            "name": "internal-ingress",
            "annotations": {
              "lastDeploymentTimestamp": "2020-08-25T09:13:37Z",
            },
            "labels": {
              "name": "internal-ingress",
              "ttl-hours": "120",
            },
          },
          "spec": {},
        },
      ]
    }
    const deleteCommands: Array<String> = []
    const logger = {
      log: (logentry: string) => {
        deleteCommands.push(logentry)
      },
    }
    kubeDeleteExpiredResources(localTestData, logger, false, new Date("2020-08-30T13:29:56Z").getTime())

    expect(deleteCommands[0]).to.equal("kubectl delete ingress internal-ingress")

    deleteCommands.length = 0

    kubeDeleteExpiredResources(localTestData, logger, false, new Date("2020-08-26T13:29:56Z").getTime())

    expect(deleteCommands.length).to.equal(0)
  })


})
