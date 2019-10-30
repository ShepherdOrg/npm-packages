export function inject(provided) {
  return function(dependencyName: string, optional: boolean = false) {
    if (!provided[dependencyName] && !optional) {
      throw new Error(
        "Required dependency <" + dependencyName + "> is not provided."
      )
    }
    return provided[dependencyName]
  }
}
