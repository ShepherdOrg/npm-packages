export function logExpiredKubeResources(resourceQueryResult, console1, dryRunOn:boolean, time: number) {
  let items = resourceQueryResult.items

  for (let item of items) {
    if (item.metadata && item.metadata.labels && item.metadata.labels["ttl-hours"]) {

      let timeToLive = Number.MAX_SAFE_INTEGER
      try {
        timeToLive = parseInt(item.metadata.labels["ttl-hours"], 10)
      } catch (e) {
        timeToLive = Number.MAX_SAFE_INTEGER
      }
      let creationTimestamp = new Date(item.metadata.creationTimestamp).getTime()
      let ageInHours = (Math.abs(time - creationTimestamp) / 36e5)

      if (ageInHours > timeToLive) {
        console1.log(`${dryRunOn?'echo DRYRUN ':''}kubectl delete ${item.kind.toLowerCase()} ${item.metadata.name}`)
      }
    }
  }
}
