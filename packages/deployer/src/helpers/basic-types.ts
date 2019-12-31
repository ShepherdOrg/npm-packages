export type FExecutionCallback = (output: string) => void
export type TFileSystemPath = string
export type TISODateString = string
export type TNamedValue<TValueType> = { name: string, value: TValueType }

export function identityMap<T>(item: T): T {
  return item
}
