import {createClient} from '@shepherdorg/ui-graphql-client/dist/tools/api/api'
import {DeployerRole, DeploymentType} from '@shepherdorg/ui-graphql-client/dist/src/API'

export function CreatePushApi(endPoint:string, apiKey:string){

    const shepherdUiClient = createClient(endPoint, {headers: {'X-Api-Key': apiKey}})

    async function pushDeploymentStateToUI(){

        const versionUpdateResult = await shepherdUiClient.upsertDeploymentVersion(
            {
                buildHostName: "gullis-macbook-pro",
                builtAt: "2019-10-21T15:53:18+00:00",
                deployedAt: "2019-10-23T11:35:44.680Z",
                deploymentVersionDeploymentId: "devtest-something-something",
                dockerImage: "plain-deployer-repo:latest",
                dockerImageTag: "plain-deployer-repo:latest",
                env: "test",
                gitBranch: "master",
                gitCommit: "2153e378877c0deaa2a3ee2491800d40f5212bc5",
                gitHash: "062b591",
                gitUrl: "git@github.com:ShepherdOrg/npm-packages.git",
                kubernetesDeploymentFiles: [],
                lastCommits: " Sun, 20 Oct 2019 17:55:38 +0000 by Guðlaugur S. Egilsson. --- Metadata updates and a few more fixes. \n\n Wed, 9 Oct 2019 13:52:56 +0000 by Guðlaugur S. Egilsson. --- First pass on shepherd-inspect, not ready at all though. \n\n Mon, 7 Oct 2019 14:28:50 +0000 by Guðlaugur S. Egilsson. --- Adding json schema for validating shepherd.json config file \n\n Fri, 4 Oct 2019 15:00:24 +0000 by Guðlaugur S. Egilsson. --- Introducing npm installable build docker script. Changing docker label for metadata packaging \n",
                version: "latest",
                versionId: "devtest-something-something-latest-2019-10-23T11:35:44.680Z"
            }
        )

        console.log(versionUpdateResult)

        return await shepherdUiClient.upsertDeployment({
            deployerRole: DeployerRole.Install,
            deploymentType: DeploymentType.Deployer,
            env: "test",
            hyperlinks: [{title:'Github',url:'https://github.com/ShepherdOrg/sandbox'}],
            lastDeploymentTimestamp: "2019-10-23T09:35:44.680Z",
            id: 'devtest-something-something',
            displayName: 'Just a sandbox test deployment'
        })
    }


    return{
        pushDeploymentStateToUI
    }



}

