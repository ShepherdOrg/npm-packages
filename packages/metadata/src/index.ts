export type TDockerImageInspection = any
export type TCompressedMetadata = string
type TTarFolderStructure = any
type THref = {
    title: string
    url: string
}
export type TShepherdMetadata = {
    displayName: string

    isDeployer: boolean
    isInfrastructure: boolean

    dbMigrationImage?: string
    lastCommits: string
    gitUrl: string
    gitHash: string
    buildDate: Date

    gitCommit?: string
    dockerImageTag?: string
    buildHostName?: string

    hyperlinks?: Array<THref>
}
export type TShepherdDeployerMetadata = TShepherdMetadata & {
    deployCommand: string
    rollbackCommand?: string
    environmentVariablesExpansionString: string
}
export type TShepherdK8sMetadata = TShepherdMetadata & {
    kubeDeploymentFiles?: TTarFolderStructure
    kubeConfigB64?: string
}
