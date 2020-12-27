export function kubeDeleteExpiredResources(resourceQueryResult, console1, dryRunOn:boolean, time: number) {
  let items = resourceQueryResult.items

  for (let item of items) {
    if (item.metadata && item.metadata.labels && item.metadata.labels["ttl-hours"]) {

      let timeToLive = Number.MAX_SAFE_INTEGER
      try {
        timeToLive = parseInt(item.metadata.labels["ttl-hours"], 10)
      } catch (e) {
        timeToLive = Number.MAX_SAFE_INTEGER
      }
      let lastDeploymentTimestamp = new Date(item.metadata.creationTimestamp).getTime()
      if(item.metadata?.annotations?.lastDeploymentTimestamp){
        lastDeploymentTimestamp = new Date(item.metadata.annotations.lastDeploymentTimestamp).getTime()
      }
      let ageInHours = (Math.abs(time - lastDeploymentTimestamp) / 36e5)

      if (ageInHours > timeToLive) {
        console1.log(`${dryRunOn?'echo DRYRUN ':''}kubectl delete ${item.kind.toLowerCase()} ${item.metadata.name}`)
      }
    }
  }
}
