export type FExecutionCallback = (output: string, code?: number) => void
export type TFileSystemPath = string
export type TISODateString = string
export type TNamedValue<TValueType> = { name: string; value: TValueType }

export type FProvideTime = () => Date

export type FTimer = (callback: (...args: any[]) => void, ms: number, ...args: any[]) => NodeJS.Timeout
