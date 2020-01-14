export function flatMapPolyfill() {
  if(!Array.prototype.flatMap){
    var flatMap = require("array.prototype.flatmap")
    /* when Array#flatMap is present */
    flatMap.shim()
  }
}
