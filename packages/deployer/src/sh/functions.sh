
function requireVariable() {
	if [ -z "${!1}" ]; then
		echo "${1} is required to have a non-empty value!"
		exit -1
	fi
}
export -f requireVariable


function requireFilePresent(){
	if [ ! -e $1 ]; then
		echo "$1 needs to be present"
		exit -1
	fi
}
export -f requireFilePresent
