import {
    TCompressedMetadata,
    TDockerImageInspection,
    TShepherdDeployerMetadata,
    TShepherdK8sMetadata,
    TShepherdMetadata
} from './index'

let uncompressBase64Tar = require('./base64tar/untar-string')

export function extractImageLabels(dockerImageMetadata: TDockerImageInspection) {
    let ContainerConfig = dockerImageMetadata[0].ContainerConfig;
    return ContainerConfig.Labels
}

function decodeShepherdMetadataLabel(imageLabel: TCompressedMetadata) {
    return uncompressBase64Tar(imageLabel).then((tarFiles) => {
        try {
            const shepherdMeta = JSON.parse(tarFiles['shepherd.json'].content)
            if (shepherdMeta.kubeConfigB64) {
                return uncompressBase64Tar(shepherdMeta.kubeConfigB64).then((kubeDeploymentFiles) => {
                    shepherdMeta.kubeDeploymentFiles = kubeDeploymentFiles
                    return shepherdMeta
                })
            } else {
                return shepherdMeta as TShepherdMetadata;
            }

        } catch (err) {

            throw new Error(`Error parsing JSON ${tarFiles}`)
        }
    })
}

function decodeBase64String(base64EncodedString: string): string {
    // @ts-ignore
    return new Buffer.from(base64EncodedString, "base64").toString();
}

export async function extractShepherdMetadata(imageLabels: Array<any>): Promise<TShepherdDeployerMetadata | TShepherdK8sMetadata> {
    if (imageLabels['shepherd.metadata']) {
        return await decodeShepherdMetadataLabel(imageLabels['shepherd.metadata'])
    } else if (imageLabels && Object.getOwnPropertyNames(imageLabels).find((propName) => propName.startsWith('shepherd.'))) {
        return Promise.resolve({
            displayName: imageLabels["shepherd.name"],
            buildDate: imageLabels["shepherd.builddate"],
            dbMigrationImage: imageLabels["shepherd.dbmigration"],
            gitBranch: imageLabels["shepherd.git.branch"],
            gitHash: imageLabels["shepherd.git.hash"],
            gitUrl: imageLabels["shepherd.git.url"],
            kubeConfigB64: imageLabels["shepherd.kube.config.tar.base64"],
            lastCommits: imageLabels["shepherd.lastcommits"] && decodeBase64String(imageLabels["shepherd.lastcommits"]),
            semanticVersion: imageLabels["shepherd.version"],
            isDeployer: !!imageLabels["shepherd.deployer"],
            deployCommand: imageLabels["shepherd.deployer.command"],
            rollbackCommand: imageLabels["shepherd.rollback.command"],
            environmentVariablesExpansionString: imageLabels["shepherd.environment.variables"],
            isInfrastructure: false
        })
    } else {
        throw new Error('No shepherd labels present in docker image Labels ' + JSON.stringify(imageLabels))
    }
}

export async function extractMetadataFromDockerInspectJson(jsonFileName = './testdata/inspected-dockers/public-repo-with-deployment-dir.json') {
    const dockerImageInspection = require(jsonFileName)
    const imageLabels = extractImageLabels(dockerImageInspection)
    return await extractShepherdMetadata(imageLabels)
}
