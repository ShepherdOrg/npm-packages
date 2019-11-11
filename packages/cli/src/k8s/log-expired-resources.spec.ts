import { logExpiredKubeResources } from "./log-expired-resources"
import { expect } from "chai"


describe("resource filtering", function() {

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
    },{
      "apiVersion": "v1",
      "kind": "Service",
      "metadata": {
        "creationTimestamp": "2019-11-06T13:29:56Z",
        "name": "myservice-internal-regular-service",
        "labels": {
          "name": "myservice-internal-regular-service"
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
    const logentries:Array<String>=[]
    const logger = {
      log:(logentry:string)=>{
        logentries.push(logentry)
      }
    }
    logExpiredKubeResources(testData, logger, true, new Date("2019-11-06T13:29:56Z").getTime())
    expect(logentries.length).to.equal(1)
    expect(logentries[0]).to.equal('echo DRYRUN kubectl delete service myservice-internal-expired-service')
  })

  it("should create delete commands testService", () => {
    const logentries:Array<String>=[]
    const logger = {
      log:(logentry:string)=>{
        logentries.push(logentry)
      }
    }
    logExpiredKubeResources(testData, logger, false, new Date("2019-11-06T13:29:56Z").getTime())
    expect(logentries.length).to.equal(1)
    expect(logentries[0]).to.equal('kubectl delete service myservice-internal-expired-service')
  })


})
