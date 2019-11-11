#!/usr/bin/env bash
export PATH=$PATH:$PWD

if [[ "$*" == *--help* ]]
then
  echo "Delete resources related to feature/branch deployments orchestrated through shepherd feature deployments."
  echo "Options:"
  echo " --dryrun   Display which resources would be affected."
  echo " --help     Display this help text."
  exit 0
fi

if [[ "$*" == *--dryrun* ]]
then
  export DELETE_COMMAND='echo DRYRUN kubectl delete "$@"'
else
  export DELETE_COMMAND='kubectl delete "$@"'
fi

#echo -n "service numberOne" | xargs  -n 1 -I {} bash -c "$DELETE_COMMAND" _ {}

echo "Finding kubernetes resources with expired time-to-live"
echo "Deployments:"
kubectl get deployment -l 'ttl-hours' -o json | kube-filter-expired-resources.js | xargs -0 -I {} bash -c "$DELETE_COMMAND" _ {}

echo "Services:"
kubectl get service -l 'ttl-hours' -o json | kube-filter-expired-resources.js | xargs -0 -I {} bash -c "$DELETE_COMMAND" _ {}

echo "Secrets:"
kubectl get secret -l 'ttl-hours' -o json | kube-filter-expired-resources.js | xargs -0 -I {} bash -c "$DELETE_COMMAND" _ {}

echo "Configmaps:"
kubectl get configmap -l 'ttl-hours' -o json | kube-filter-expired-resources.js | xargs -0 -I {} bash -c "$DELETE_COMMAND" _ {}

echo "HorizontalPodAutoscalers:"
kubectl get hpa -l 'ttl-hours' -o json | kube-filter-expired-resources.js | xargs -0 -I {} bash -c "$DELETE_COMMAND" _ {}

echo "Ingress controllers:"
kubectl get ingress -l 'ttl-hours' -o json | kube-filter-expired-resources.js | xargs -0 -I {} bash -c "$DELETE_COMMAND" _ {}
