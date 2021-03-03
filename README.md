# Shepherd npm-packages

Monorepo for Shepherd packages and tools.

# What is Shepherd?

Shepherd is a collection of tools meant to simplify and streamline CI/CD processes, designed around the idea of 
using docker registries as a universal artifact repository.

It is designed to work for small to medium sized software teams managing tens or hundreds of deployments.
How well it scales above that has not been tested at the time of writing this.

# Why Shepherd?
- Works with any CI/CD server. Use Jenkins, Teamcity, CircleCI to set up your task/job runners. Let Shepherd handle the 
  complex plumbing.
- Combine [any kind of deployment](#any-kind) in a uniform CI/CD and configuration management pipeline. Local and cloud. Custom and standard.
- Lightweight. No extra services or servers required. A postgres database can be used to optimize deployment state tracking.
- Opinionated around CI/CD best practices. Discourage integrated tests at build time, support 
- Binary promotion, also across branches. Shepherd-build-docker does not build an image twice from the exact
  same sources.
- Automagic branch deployment in kubernetes. Shepherd knows how to modify kubernetes deployment documents for
  common deployment document types, including services, deployments, cronjobs, configmaps and ingresses.
- Deploy and install to anything scriptable in a docker image. Today, that is almost everything, but common uses are:
  - Database migrations.
  - Terraform deployments.
  - AWS cloud formation deployments.
- Grouped configuration management, and an easy overview of projects managed by a team using the herd.yaml document.  
- Simplified management of multiple development environments (dev, test, capacity, staging, prod)
- Does not rely on plug-ins. Instead it relies on annotated docker images. This means that any custom deployment
  logic you write will work with basically any pipeline that can run docker containers, not only with Shepherd,
  minimising the lock-in risk.

# Shepherd CLI

The command line interface contains the main entrypoints for using shepherd to package and deploy
shepherd-managed images.

 [More about the CLI tools here](./packages/cli/README.md)

# How does it work
Shepherd is architected around Docker, and relies on its Label mechanism to annotate docker images. So
in a project that Shepherd is supposed to deploy, you will always find 

```Dockerfile
ARG SHEPHERD_METADATA
LABEL shepherd.metadata=${SHEPHERD_METADATA}
```

at the end of the Dockerfile. Images are then built using the command ```shepherd-build-docker```, which
gathers and packages image annotations with the docker image. 

On the deployment end, images that are managed collectively are declared in a yaml file called ```herd.yaml```

```yaml
images:
  test-image:
    image: testenvimage
    imagetag: 0.0.0
  test1:
    image: testenvimage
    imagetag: 0.0.0
    featureDeployment: true
    timeToLiveHours: 48

```

Shepherd then has mechanism to track versions and configurations that are deployed, and does not deploy again until either
the version or configuration has changed.

Configurations are not managed by shepherd, it is a tool to apply configurations and version changes to 
multiple targets in a uniform manner. Secret management should be managed in a manner appropriate for your team, but
a classic setup would be to use CircleCI environment variables, or Jenkins credentials store.

Note that secrets that are made available to all deployments at deployment time, meaning that you must trust deployment
authors. 

A future version of Shepherd may support declaring the environment for a deployment in the herd.yaml in order
to reduce the exposure of secrets at deployment time.



# Examples

Some examples can be found [here](./examples/README.md)

# Any kind
Of course not every conceivable deployment from all times is supported. If you are thinking about an
windows installer with a GUI, you are probably out of luck unless you have a container technology
which can simulate a GUI and script that installer through that. Any kind here means "any kind that
can be scripted inside a docker container".
