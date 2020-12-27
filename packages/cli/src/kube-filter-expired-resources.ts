#!/usr/bin/env node

'use strict';
import { kubeDeleteExpiredResources } from "./k8s/delete-expired-resources"

const dryRunOn = process.argv.indexOf("--dryrun") > 0

const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

if(process.env.DEBUG_LOG){
    console.debug = console.debug || console.info;
} else{
    console.debug = function () {};
}

let stdin ="";

rl.on('line', function(line){
    stdin += line + "\n";
});

rl.on('close', function(){
    let kubeResourceList=JSON.parse(stdin);
    kubeDeleteExpiredResources(kubeResourceList, console,dryRunOn, new Date().getTime())
    process.exit(0);
});
