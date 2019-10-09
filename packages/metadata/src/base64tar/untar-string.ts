const tar=require('tar');
let Duplex = require('stream').Duplex;

function bufferToStream(buffer) {
    let stream = new Duplex();
    stream.push(buffer);
    stream.push(null);
    return stream;
}


export default function(base64EncodedTar):Promise<any>{
    return new Promise(function(resolve, reject){
        const buffer = Buffer.from(base64EncodedTar, "base64");

        let files={};

        try{

            bufferToStream(buffer).pipe(new tar.Parse())
                .on('entry', entry => {
                    let file={
                        path:entry.path,
                        content:""
                    };
                    files[entry.path]=file;
                    entry.on('data', function (tarFileData) {
                        file.content += tarFileData.toString('utf-8');
                    });

                    // resolve(entry);
                }).on('close', function(){
                resolve(files);
            });
        } catch(e){
            reject(e);
        }

    })

};
