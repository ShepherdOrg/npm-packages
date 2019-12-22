export function detectRecursion(obj: any) {
  function detect(obj: any, seenObjects: any[]) {
    if (obj && typeof obj === "object") {
      if (seenObjects.indexOf(obj) !== -1) {
        return ["RECURSION!"]
      }
      seenObjects.push(obj)
      for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
          let detected: any[] = detect(obj[key], seenObjects)
          if (detected.length) {
            detected.unshift(key)
            return detected
          }
        }
      }
      seenObjects.pop()
    }
    return []
  }

  return detect(obj, [])
}
