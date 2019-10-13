#!/bin/bash


function outputK8sApiServerEndpoint(){
	if [[ ! -z "${KUBECONFIG}" &&  -e "${KUBECONFIG}" ]]; then
		echo "Using k8s API endpoint $(cat ${KUBECONFIG} | grep server:) configured in ${KUBECONFIG}"
	else
		echo "kubectl could not be configured, KUBECONFIG file (${KUBECONFIG}) does not exist."
		exit -1
	fi
}

function retrieve-kube-config(){

	CONFIG_EXISTS=$(aws s3 ls ${KUBE_CONFIG_S3_PATH} > /dev/null 2>&1; echo $?)

	if [ "${CONFIG_EXISTS}" = "0" ];
	then
		echo "Fetching KUBECONFIG from ${KUBE_CONFIG_S3_PATH}"
		aws s3 cp ${KUBE_CONFIG_S3_PATH} ${KUBECONFIG}
		export KUBECONFIG=$(pwd)/kubeconf/${CLUSTER_NAME}
	else
		echo "${KUBE_CONFIG_S3_PATH} not found, aws s3 exit code ${CONFIG_EXISTS}"
		exit ${CONFIG_EXISTS}
	fi
}


function configureKubeCtl(){
	set -e
	if [ -e ~/.kube/config ]; then
		echo "Using default KUBECONFIG"
		export KUBECONFIG=~/.kube/config
	fi

	if [ -e ${KUBECONFIG} ]; then
		outputK8sApiServerEndpoint
	else
		retrieve-kube-config
		outputK8sApiServerEndpoint
	fi

}

