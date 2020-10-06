# npm-packages

Shepherd packages to support the Shepherd CD tool.

# What is Shepherd

Shepherd is a continuous deployment tool based on the idea to use Docker Registry as a universal artifact repository
by augmenting docker images with deployment related metadata, and providing the tools to deploy those artifacts.

This idea promises to simplify deployment management significantly by allowing the deployment toolchain to know only
one type of artifact, and delegating all deployment complexity to the artifact itself. Since the artifact has all
the capabilities of an operating system, this supports all types of deployment that can be performed in a fully automatic 
manner. This includes technologies such as Terraform, CloudFormation, Ansible, Helm, Bash scripting, or basically anything
that can be executed in a docker container.

# Getting started

## Install
Shepherd is distributed as an npm package
```
npm install shepherdorg/cli
```
This installs the command line tools to build, inspect and deploy shepherd-enabled docker images.

## Configure

In order to be able to recognize a docker image as deployment artifact, shepherd-build-docker needs a shepherd.json 
metadata file to be present.

```json 

{
  "dockerRegistry": "mylocalregistry:5000",
  "dockerRepository": "plan-deployer-image",
  "displayName": "Just a plain deployer",
  "deployerRole": "install",
  "environment": [
    {
      "name": "MY_ENV",
      "value": "MICROSERVICES_POSTGRES_RDS_HOST"
    }
  ],
  "deployCommand": "ls",
  "rollbackCommand": "cat"
}

```

## Build

```
shepherd-build-docker <dockerFilePath>

```

## Deploy


# Moving to multiple artifacts

.. how to separate deployments into a separate process, using herd.yaml and herd.env


# How does that look CI/CD context

.... drawing of a pipeline and where Shepherd comes into play
