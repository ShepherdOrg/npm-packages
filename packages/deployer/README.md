# Shepherd deployer


## kubernetes deployment file templating

Kuberenetes yaml files extracted from docker deployment metadata are treated as handlebars templates, 
with strict option on, and HTML escaping off (meaning that {{}} and {{{}}} syntax is equivalent)

All environment variables present when the cli is invoked can be expanded in the templates.
So in order to make configuration available at deployment time, all you have to do is make it
available in the shell that runs shepherd-deploy 

The templating supported is designed to get secrets and configuration into kubernetes deployment files.
The helpers available are 

Base64Encode and Base64EncodeFile

See [Expand Template](./src/template/expandtemplate.spec.ts) tests for exact usage.

Additionally, envsubst syntax is supported (deprecated). Please avoid use, support will be removed at the
earliest convenient opportunity.

