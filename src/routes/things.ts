/*
 *  Things routes (AWS IoT Core)
 *
 *  Resources:
 *      getting started: AWS CLI:       https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
 *                       Credentials:   https://docs.aws.amazon.com/cli/latest/userguide/cli-authentication-user.html
 *                       
 * 
 *      credentials:     https://docs.aws.amazon.com/rekognition/latest/dg/setup-awscli-sdk.html
 *                       https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/getting-started-nodejs.html#getting-started-nodejs-credentials
 *                       https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html
 * 
 *      SDK info (!):    https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/
 *                       https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot-data-plane/
 *                       https://docs.aws.amazon.com/iot/latest/apireference/API_Operations.html
 * 
 *  required environment variables:
 *  AWS_ACCESS_KEY_ID
 *  AWS_SECRET_ACCESS_KEY
 *  
 * 
 *  note:   - Fleet Indexing must be enabled to get the device connection:
 *              $ aws iot update-indexing-configuration --thing-indexing-configuration thingIndexingMode=REGISTRY_AND_SHADOW,thingConnectivityIndexingMode=STATUS
 *            To view the connection state:
 *              $ aws iot search-index --index-name "AWS_Things" --query-string "thingName:EdgeBerry_development"
 */
import { DescribeThingCommand, IoTClient, ListThingsCommand, SearchIndexCommand } from '@aws-sdk/client-iot';
import { GetThingShadowCommand, IoTDataPlaneClient, PublishCommand, PublishRequest } from '@aws-sdk/client-iot-data-plane';

import { Router } from "express";
import { user_getUserFromCookie } from '../user';
const router = Router();

const iotClientConfig = {
    region: 'eu-north-1',
    credentials:{
        accessKeyId: 'AKIA6ODU6EBXB34OVH7O',
        secretAccessKey: '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'
    }
}




/* Get list of all things */
router.get('/list', async(req:any, res:any)=>{
    try{
        // Check for an authenticated user
        if( !await user_getUserFromCookie(req.cookies.jwt) )
        return res.status(403).send({message:'Unauthorized'});
        // Create a new client
        const AWSIoTClient = new IoTClient( iotClientConfig );
        // Create and execute the 'list things' command
        var command = new ListThingsCommand( {maxResults:20} );
        var response = await AWSIoTClient.send( command );
        return res.send( response.things );
    }
    catch(err:any){
        return res.status(500).send({message:err.name+': '+err.message});
    }
});

/*  
 *  Get Thing Description
 */
router.get('/description', async(req:any, res:any)=>{
    // Thing name in URL parameters
    if( typeof req.query.thingName !== 'string')
    return res.status(400).send({message:"No thingName"});

    try{
        // Check for an authenticated user
        if( !await user_getUserFromCookie(req.cookies.jwt) )
        return res.status(403).send({message:'Unauthorized'});
        // Create a new client
        const AWSIoTClient = new IoTClient( iotClientConfig );
        // Create and execute the 'describe thing' command
        const command = new DescribeThingCommand({thingName:req.query.thingName});
        const response = await AWSIoTClient.send( command );
        return res.send(response);
    }
    catch(err:any){
        return res.status(500).send({message:err.name+': '+err.message});
    }
});

/*  
 *  Get thing Fleet index
 *  Get the Fleet index by Thing name. Fleet indexing must be enabled (!)
 */
router.get('/index', async(req:any, res:any)=>{
    // Thing name in URL parameters
    if( typeof req.query.thingName !== 'string') return res.status(400).send({message:"No thingName"});

    try{
        // Check for an authenticated user
        if( !await user_getUserFromCookie(req.cookies.jwt) )
        return res.status(403).send({message:'Unauthorized'});
        // Create a new client
        const AWSIoTClient = new IoTClient( iotClientConfig );
        // Create and execute the 'search index' command
        const command = new SearchIndexCommand({queryString:'thingName:'+req.query.thingName});
        const response = await AWSIoTClient.send( command );
        if( response.things && response.things.length >=1 )
        return res.send( response.things[0] );
        // Not found
        else return res.status(404).send({message:req.query.thingName+' not found'});
    }
    catch(err:any){
        return res.status(500).send({message:err.name+': '+err.message});
    }
});

/* Get Shadow of a specific thing */
router.get('/shadow', async(req:any, res:any)=>{
    // Thing name in URL parameters
    if( typeof req.query.thingName !== 'string') return res.status(400).send({message:"No thingName"});

    try{
        // Check for an authenticated user
        if( !await user_getUserFromCookie( req.cookies.jwt) )
        return res.status(403).send({message:'Unauthorized'});
        // Create a new Data Plane client
        const AWSDataPlaneClient = new IoTDataPlaneClient( iotClientConfig );
        // Create and execute the 'get thing shadow' command
        const command = new GetThingShadowCommand({thingName:req.query.thingName, shadowName:'edgeberry-device'})
        const response = await AWSDataPlaneClient.send( command );
        if( response.payload )
        return res.send(JSON.parse( new TextDecoder().decode(response.payload)));

        return res.status(500).send({message:"No payload"});
    }
    catch(err:any){
        return res.status(500).send({message:err.name});
    }
});

/*
 *  Direct Method
 *  Invoke a remote command on your IoT device
 * 
 *  https://docs.aws.amazon.com/wellarchitected/latest/iot-lens/device-commands.html
 *  https://docs.aws.amazon.com/iot/latest/apireference/API_iotdata_Publish.html
 *  
 */

router.post('/directmethod', (req:any, res:any)=>{
    // Check for the presence of all required data
    if( typeof(req.body) !== 'object' ||
        typeof(req.body.deviceId) !== 'string' ||
        typeof(req.body.methodName) !== 'string' ||
        typeof(req.body.methodBody) !== 'string')
    return res.status(401).send({message:'Data invalid'});
    
    invokeDirectMethod( req.body.deviceId, req.body.methodName, req.body.methodBody )
        .then((response)=>{
            //console.log(response)
            return res.send(response);
        })
        .catch((err:any)=>{
            //console.log(err)
            return res.status(500).send({message:err.toString()});
        });
});

// Send Command (direct method) to device
function invokeDirectMethod( deviceId:string, methodName:string, methodBody:string ){
    return new Promise<object|string>( async(resolve, reject)=>{
        const requestId =  crypto.randomUUID();
        const payload = JSON.stringify({
            name: methodName,
            body: methodBody
        });

        const input:PublishRequest = {
            topic:'$aws/things/'+deviceId+'/methods/post',
            qos: 0,
            retain: false,
            payload: Buffer.from(payload),
            payloadFormatIndicator: 'UTF8_DATA',
            contentType: 'application/json',
            responseTopic: '$aws/things/'+deviceId+'/methods/response',
            correlationData: btoa(requestId),
            messageExpiry: 5000
        }

        try{
            // Create a new Data Plane client
            const AWSDataPlaneClient = new IoTDataPlaneClient( iotClientConfig );

            const command = new PublishCommand(input);
            const response = await AWSDataPlaneClient.send(command);
            resolve(response);
        }
        catch(err){
            reject(err);
        }
    });
}

export default router;