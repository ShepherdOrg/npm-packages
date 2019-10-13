#@IgnoreInspection BashAddShebang

has_param() {
    local term="$1"
    shift
    for arg; do
        if [[ $arg == "$term" ]]; then
            return 0
        fi
    done
    return 1
}

function pullIfLatest(){
	if [ "${SHEPHERD_VERSION}" = "latest" ]
	then
		echo "pulling shepherdorg/shepherd:${SHEPHERD_VERSION}"
		docker pull shepherdorg/shepherd:${SHEPHERD_VERSION}
	fi
}
export -f pullIfLatest


function absolutepath(){
	echo "$(cd $(dirname "${1}"); pwd -P)/$(basename "${1}")"
}
export -f absolutepath

function generateDeploymentEnv(){
	# Import environment vars from current shell, except for those on the exclusionlist
	compgen -e | sort > ${tmpdir}/completeenvlist.txt
	comm -23 ${tmpdir}/completeenvlist.txt ${THISDIR}/deploy/exclusionlist.txt > ${tmpdir}/envlist.txt

	arrayString=$(cat  ${tmpdir}/envlist.txt |tr "\n" " ")
	arr=($arrayString)

	echo "" > ${tmpdir}/_envmap.env # Empty the file
	for i in "${arr[@]}"
	do
            echo $i=\${$i} >> ${tmpdir}/_envmap.env
	done

	cat ${tmpdir}/_envmap.env | envsubst  > ${tmpdir}/_parameterlist.env
}
export -f generateDeploymentEnv
