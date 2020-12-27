import { execCmd } from "../../src/exec/exec-cmd"

export async function getDockerTags(image: string) {
  return execCmd("docker", ["inspect", image],
  ).then(({ stdout }) => {
    const dockerMeta = JSON.parse(stdout)
    return dockerMeta[0].RepoTags
  })

}
