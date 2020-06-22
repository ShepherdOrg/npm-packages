import { TEnvironmentVariables } from "@shepherdorg/metadata"
import { TNamedValue } from "../../helpers/basic-types"
import { expandTemplate } from "@shepherdorg/hbs-template"

export function environmentToEnvSetters(envList: string[], environment: TEnvironmentVariables) {
  envList = envList.concat(environment.map((value: TNamedValue<string>) => expandTemplate(`${value.name}=${value.value}`)))
  return envList
}
