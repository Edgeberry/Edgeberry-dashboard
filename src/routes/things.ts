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
 * 
 *  note:   - Fleet Indexing must be enabled to get the device connection:
 *              $ aws iot update-indexing-configuration --thing-indexing-configuration thingIndexingMode=REGISTRY_AND_SHADOW,thingConnectivityIndexingMode=STATUS
 *            To view the connection state:
 *              $ aws iot search-index --index-name "AWS_Things" --query-string "thingName:EdgeBerry_development"
 */
import { DeleteCertificateCommand, DeleteThingCommand, DescribeCertificateCommand, DescribeEndpointCommand, DescribeThingCommand, DetachPolicyCommand, DetachThingPrincipalCommand, ListAttachedPoliciesCommand, ListThingPrincipalsCommand, ListThingsCommand, SearchIndexCommand, UpdateCertificateCommand, UpdateThingCommand } from '@aws-sdk/client-iot';
import { GetRetainedMessageCommand, GetThingShadowCommand, PublishCommand, PublishRequest } from '@aws-sdk/client-iot-data-plane';
import { awsIotClient as AWSIoTClient, awsDataPlaneClient as AWSDataPlaneClient, edgeberryShadowName, awsIotClient } from '..';
import { Router } from "express";
import { user_getUserFromCookie } from '../user';
import { device_checkDeviceOwner, device_checkKnownHardwareId, device_updateDeviceOwner } from '../devices';
const router = Router();

/*
 *  Get Provisioning Parameters
 *  This function is called by the Devices to automatically
 *  get the Dashboard's provisioning parameters.
 * 
 *  TODO: this function is a SECURITY RISK, because it can be 
 *  bruteforced to eventually get a UUID that is actually in our database!
 */
router.get('/provisioningparameters', async(req:any, res:any)=>{
    // The Device's Hardware UUID must be in the parameters
    if( typeof(req.body) !== 'object' ||
        typeof(req.body.hardwareId) !== 'string')
    return res.status(401).send({message:'Data invalid'});

    try{
        // Lookup the Device's Hardware UUID in the database of the
        // known (official) Edgeberry devices.
        if( !await device_checkKnownHardwareId(req.body.hardwareId) )
        return res.status(401).send({message:'Unknown Device ID'});

        // Get the AWS IoT Core endpoint
        const getEndpointCommand = new DescribeEndpointCommand({endpointType:'iot:Data-ATS'});
        const getEndpointResponse = await awsIotClient.send(getEndpointCommand);
        
        // Get the AWS IoT Core provisioning (claim) certificate from the certificate ID (environment variables)
        const getProvCertCommand = new DescribeCertificateCommand({certificateId:process.env.AWS_IOT_PROVISIONING_CERT_ID});
        const getProvCertResponse = await awsIotClient.send(getProvCertCommand);
        
        const parameters = {
            endpoint: getEndpointResponse.endpointAddress,
            certificate: getProvCertResponse.certificateDescription?.certificatePem,
            privateKey: process.env?.AWS_IOT_PROVISIONING_KEY    // Private Key is in the environment variables
        }

        return res.send(parameters);
    }
    catch(err:any){
        return res.status(500).send({message:err.name+': '+err.message});
    }
});

/* ===================================================================== */

/*
 *  GET Thing List
 *  Get the list of all the devices owned by this user. Attribute 'deviceOwner'
 *  in the 'Thing Type' is the logged-in user's UID.
 * 
 *  https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/command/ListThingsCommand/
 */
router.get('/list', async(req:any, res:any)=>{
    try{
        // Get the authenticated user
        const user:any = await user_getUserFromCookie(req.cookies.jwt);
        if( !user ) return res.status(403).send({message:'Unauthorized'});
        // Create and execute the 'list things' command
        // with parameters to search for the deviceOwner ID
        const parameters = {
            maxResults: 40,
            attributeName: "deviceOwner",
            attributeValue: user.uid
        }
        var command = new ListThingsCommand( parameters );
        var response = await AWSIoTClient.send( command );
        return res.send( response.things );
    }
    catch(err:any){
        return res.status(500).send({message:err.name+': '+err.message});
    }
});

/*  
 *  Get Thing Description
 *  -> contains the attributes from 'Thing type'
 */
router.get('/description', async(req:any, res:any)=>{
    // Thing name in URL parameters
    if( typeof req.query.thingName !== 'string')
    return res.status(400).send({message:"No thingName"});

    try{
        // Get the authenticated user
        const user:any = await user_getUserFromCookie(req.cookies.jwt) ;
        if( !user ) return res.status(403).send({message:'Unauthorized'});
        // Check if user owns this device
        if(!await device_checkDeviceOwner(req.query.thingName, user.uid))
        return res.status(403).send({message:'Unauthorized'});

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
 *  Update the device description
 *
 *  https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/command/UpdateThingCommand/  
 */
router.post('/description', async(req:any, res:any)=>{
    // Thing name in URL parameters
    if( typeof req.query.thingName !== 'string')
    return res.status(400).send({message:"No thingName"});
    // Check for the presence of all required data
    if( typeof(req.body) !== 'object' ||
        typeof(req.body.deviceName) !== 'string' ||
        typeof(req.body.deviceOwner) !== 'string' )
    return res.status(401).send({message:'Data invalid'});
    try{
        // Get the authenticated user
        const user:any = await user_getUserFromCookie(req.cookies.jwt) ;
        if( !user ) return res.status(403).send({message:'Unauthorized'});
        // ToDo: Check if user owns this thing
        // Update the description
        const parameters = {
            thingName: req.query.thingName,
            attributePayload:{
                attributes:{
                    deviceName: req.body.deviceName,
                    deviceOwner: req.body.deviceOwner
                }
            }
        }
        // Create and execute the Thing update command
        const command = new UpdateThingCommand( parameters );
        const response = await AWSIoTClient.send( command );
        return res.send(response);
    } 
    catch(err:any){
        return res.status(500).send({message:err.name});
    }
});

/*  
 *  Delete Thing
 *  When a user deletes a device, it becomes free again to be claimed
 *  TODO: improve this procedure and check all steps
 *  https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/command/DeleteThingCommand/
 *  https://stackoverflow.com/questions/36003491/how-to-delete-aws-iot-things-and-policies
 */
router.post('/delete', async(req:any, res:any)=>{
    // Thing name in URL parameters
    if( typeof req.query.thingName !== 'string')
    return res.status(400).send({message:"No thingName"});
    // Get the authenticated user
    const user:any = await user_getUserFromCookie(req.cookies.jwt) ;
    if( !user ) return res.status(403).send({message:'Unauthorized'});
    // Check if user owns this device
    if(!await device_checkDeviceOwner(req.query.thingName, user.uid))
    return res.status(403).send({message:'Unauthorized'});

    try{

        // List Thing principals
        const listThingPrincipalsCommand = new ListThingPrincipalsCommand({thingName:req.query.thingName});
        const thingPrincipals = await AWSIoTClient.send( listThingPrincipalsCommand );
        console.log(thingPrincipals);
        // Detach all thing principals
        if( thingPrincipals.principals )
        for( const principal of thingPrincipals.principals){
            try{
                // Detach the certificate
                const detachThingPrincipalCommand = new DetachThingPrincipalCommand({thingName:req.query.thingName, principal:principal});
                await AWSIoTClient.send( detachThingPrincipalCommand );
                
                // List all policies attached to the certificate and detach each policy from the certificate.
                // The 'principal' is the certificate ARN
                // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/command/ListAttachedPoliciesCommand/
                // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/command/DetachPolicyCommand/
                const listAttachedPoliciesCommand = new ListAttachedPoliciesCommand({target:principal});
                const attachedPoliciesList = await AWSIoTClient.send( listAttachedPoliciesCommand );
                if( attachedPoliciesList.policies && attachedPoliciesList.policies?.length > 0 ){
                    for( const policy of attachedPoliciesList.policies){
                        const detachPolicyCommand = new DetachPolicyCommand({policyName:policy.policyName, target:principal});
                        await AWSIoTClient.send( detachPolicyCommand );
                    }
                }
                // Deactivate the certificate.
                // Get the certificate ID from the principal
                // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/command/UpdateCertificateCommand/
                const certificateId = principal.split('/').pop();
                const deactivateCertificateCommand = new UpdateCertificateCommand({certificateId:certificateId, newStatus:'INACTIVE'});
                await AWSIoTClient.send( deactivateCertificateCommand );

                // Delete the certificate
                // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/command/DeleteCertificateCommand/
                const deleteCertificateCommand = new DeleteCertificateCommand({certificateId:certificateId, forceDelete:true})
                AWSIoTClient.send( deleteCertificateCommand );
            }
            catch(err){
                console.error("Unclaim device: detachment of principals failed");
            }
        };

        //Create and execute the 'delete thing' command
        const deleteThingcommand = new DeleteThingCommand({thingName:req.query.thingName});
        const response = await AWSIoTClient.send( deleteThingcommand );
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
        // Get the authenticated user
        const user:any = await user_getUserFromCookie(req.cookies.jwt) ;
        if( !user ) return res.status(403).send({message:'Unauthorized'});

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
        // Get the authenticated user
        const user:any = await user_getUserFromCookie(req.cookies.jwt) ;
        if( !user ) return res.status(403).send({message:'Unauthorized'});

        // Create and execute the 'get thing shadow' command
        const command = new GetThingShadowCommand({thingName:req.query.thingName, shadowName: edgeberryShadowName})
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

router.post('/directmethod', async(req:any, res:any)=>{
    // Check for the presence of all required data
    if( typeof(req.body) !== 'object' ||
        typeof(req.body.deviceId) !== 'string' ||
        typeof(req.body.methodName) !== 'string' ||
        typeof(req.body.methodBody) !== 'string')
    return res.status(401).send({message:'Data invalid'});
    try{
        // Get the authenticated user
        const user:any = await user_getUserFromCookie(req.cookies.jwt) ;
        if( !user ) return res.status(403).send({message:'Unauthorized'});
    
        invokeDirectMethod( req.body.deviceId, req.body.methodName, req.body.methodBody )
            .then((response)=>{
                //console.log(response)
                return res.send(response);
            })
            .catch((err:any)=>{
                //console.log(err)
                return res.status(500).send({message:err.toString()});
            });
    } 
    catch(err:any){
        return res.status(500).send({message:err.name});
    }
});

// Send Command (direct method) to device
function invokeDirectMethod( deviceId:string, methodName:string, methodBody:string, timeout?:number ){
    return new Promise<object|string>( (resolve, reject)=>{
        const requestId =  crypto.randomUUID();
        const payload = JSON.stringify({
            name: methodName,
            body: methodBody,
            requestId: requestId
        });

        // Create the publish request input
        const input:PublishRequest = {
            topic:'edgeberry/things/'+deviceId+'/methods/post',
            qos: 0,
            payload: Buffer.from(payload),
            payloadFormatIndicator: 'UTF8_DATA',
            contentType: 'application/json',
            messageExpiry: 5000
        }
        // Create and send the publish request command
        const command = new PublishCommand(input);
        AWSDataPlaneClient.send(command, (error)=>{
            if(error) return reject(error);
            // Response
            // We cannot directly subscribe directly to the response topic for the direct methods, because the AWS SDK
            // works with HTTP calls. So this workaround for getting the response is working with retained messages, published
            // on a response topic with the request ID.
            //
            //      retained messages:
            //      https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot-data-plane/command/GetRetainedMessageCommand/

            // Watchdog: if there's no result after a timeout, reject.
            var watchdog = setTimeout(()=>{
                clearInterval(pollingInterval);
                return reject("Response timed out");
            },timeout?timeout*1000:10*1000);
            // Create the command to listen for the retained message on the response topic
            const retainedMessageInput = {topic:'edgeberry/things/'+deviceId+'/methods/response/'+requestId};
            const retainedMessageCmd = new GetRetainedMessageCommand(retainedMessageInput);
            // Poll the retained message on the response topic
            // for a response to our request (by requestId)
            var pollingInterval = setInterval(async()=>{
            AWSDataPlaneClient.send(retainedMessageCmd).then((result)=>{
                const payload = JSON.parse(new TextDecoder().decode(result.payload));
                if( payload.requestId === requestId ){
                    // Clear the watchdog and the polling interval
                    clearInterval(pollingInterval);
                    clearTimeout(watchdog);
                    // Clear the retained message on the response topic
                    const input:PublishRequest = {
                        topic:'edgeberry/things/'+deviceId+'/methods/response/'+requestId,
                        qos: 0,
                        retain: true,                           // A retained message with a
                        payload: Buffer.from(''),               // zero-byte payload clears the
                        payloadFormatIndicator: 'UTF8_DATA',    // previously retained messsage!
                        contentType: 'application/json',
                        messageExpiry: 5000
                    }
                    const command = new PublishCommand(input);
                    AWSDataPlaneClient.send(command);
                    // Done, resolve!
                    return resolve(payload);
                    }
                })
                // Do nothing with these errors, but to prevent crashing on
                // 'retained message not found'-like errors, we'll catch them.
                .catch(()=>{});    
            },300);
        });
    });
}

/*
 *  Claim Thing
 */
router.get('/claim', async(req:any, res:any)=>{
    // Thing name in URL parameters
    if( typeof req.query.thingName !== 'string') return res.status(400).send({message:"No thingName"});
    // Get the authenticated user
    const user:any = await user_getUserFromCookie(req.cookies.jwt) ;
    if( !user ) return res.status(403).send({message:'Unauthorized'});
    
    const uuid = req.query.thingName;
    console.log("Claim attempt for: "+uuid);

    try{
        // TODO: Check if device UUID exists !IMPORTANT
        // We will do this later, for now we're not checking the 'known devices'
        // list

        // Check if device is free to be claimed
        if( !await device_checkDeviceOwner( uuid, "unclaimed" ))
        return res.status(403).send({message:'Unauthorized'});

        // Validate the user is physical owner of the device
        // by requiring the button to be pressed
        invokeDirectMethod( uuid, 'linkToUserAccount','', 10 )
        .then((result:any)=>{
            // If the user pressed the button, update the device's 
            // owner to the current user's ID
            device_updateDeviceOwner( uuid, user.uid );
            return res.send({message:'success'});
        })
        // The direct method invocation didn't work
        .catch((err)=>{
            return res.status(500).send({message:"That didn't work..."});
        });
    }
    catch(err:any){
        return res.status(500).send({message:err.name});
    }
});

export default router;