# Versionist
in British English

2. someone who creates or prefers a version

# Scope
This module handles version determination for shepherd docker building.

This package handles determining semantic version and git hash, intended to use for tagging docker images, but
may have other uses.

Input: Directory containing a Dockerfile to create a version for.

Output: Image name (docker repository), docker tags, semantic version and git sha for docker sources.

# Coupling

This module is tightly coupled with git, it is considered a base library here, and is therefore used from unit tests.

# To consider

Consider options to ignore files in .dockerignore when generating git hash.

Usecases include determining whether a docker image needs to be built in a monorepo using the git hash and
consistent versioning of docker images.


$ Todo before merge

Output test report as something that can be embedded in the readme

1. Upgrade all packages dependencies.
1. Test
