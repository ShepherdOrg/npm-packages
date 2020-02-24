import { Oops } from "oops-error"

export function isOops(err: Error): err is Oops {
  return Boolean((err as Oops).category)
}
