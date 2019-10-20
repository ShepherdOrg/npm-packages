const _ = require('lodash');

const extractShepherdMetadata = require('@shepherdorg/metadata/dist/dockerLabelParser').extractShepherdMetadata;

function rewriteDockerLabels (dockerLabelsObject, obsoleteQualifier, newQualifier) {
    const result = Object.assign({}, dockerLabelsObject);
    _(result).keys().each((dockerLabelKey) => {
        if (dockerLabelKey.startsWith(obsoleteQualifier)) {
            const newKey = dockerLabelKey.replace(obsoleteQualifier, newQualifier);
            result[newKey] = result[dockerLabelKey];
            delete result[dockerLabelKey];
        }
    });
    return result;
}

const addShepherdMetadata = async (imageMetadata) => {

    let imageLabels = rewriteDockerLabels(imageMetadata.dockerLabels, 'is.icelandairlabs', 'shepherd');
    const shepherdMetadata = await extractShepherdMetadata(imageLabels);

    return {
        imageDefinition: imageMetadata.imageDefinition,
        dockerLabels: imageMetadata.dockerLabels,
        shepherdMetadata: shepherdMetadata
    };
};

module.exports = addShepherdMetadata;
