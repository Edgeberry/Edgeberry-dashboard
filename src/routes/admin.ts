/*
 *  Administration routes
 */

import { Router } from "express";
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ListThingsCommand } from '@aws-sdk/client-iot';
import { user_checkUserForRole, user_getUserFromCookie, user_listUsers } from '../user';
import { awsIotClient, dynamoDocumentClient as documentClient } from '..';
const router = Router();

const deviceTable = 'edgeberry-dashboard-devices';

/*
 *  Device onboarding
 *  Adding the device to the Edgeberry ecosystem
 */
router.post('/onboard', async(req:any, res:any)=>{
    // Check for the presence of all required data
    if( typeof(req.body) !== 'object' ||
        typeof(req.body.id) !== 'string' ||
        typeof(req.body.hardwareVersion) !== 'string' ||
        typeof(req.body.batchNumber) !== 'string')
    return res.status(401).send({message:'Data invalid'});

    // Get the authenticated user
    const user:any = await user_getUserFromCookie(req.cookies.jwt);
    if( !user ) return res.status(403).send({message:'Unauthorized'});
    // Check if the user has admin rights
    if(!user_checkUserForRole(user, "admin"))
    return res.status(403).send({message:'Unauthorized'});

    // TODO: run more checks on the provided data
    // e.g. check of, by major coincidence, this device ID exists already

    // Create the new device object
    const device = {
        uuid: req.body.id,
        hardwareVersion: req.body.hardwareVersion,
        batchNumber: req.body.batchNumber,
        creationDate: Date.now(),
        adminId: user.uid
    }
    
    // Create the command to create the new device
    const command = new PutCommand({
        TableName: deviceTable,
        Item:device
    });
    
    // Create the device in the database
    documentClient.send(command)
    .then((result)=>{
        return res.send({message:'success'})
    })
    .catch((err)=>{
        return res.status(500).send({message:err.toString()});
    })
});

/*  
 *  Get list of all devices
 *  
 */
router.get('/devices/list', async(req:any, res:any)=>{
    // Get the authenticated user
    const user:any = await user_getUserFromCookie(req.cookies.jwt);
    if( !user ) return res.status(403).send({message:'Unauthorized'});
    // Check if the user has admin rights
    if(!user_checkUserForRole(user, "admin"))
    return res.status(403).send({message:'Unauthorized'});
    
    try{
        // Create and execute the 'list things' command
        var command = new ListThingsCommand( {maxResults:40} );
        var response = await awsIotClient.send( command );
        return res.send( response.things );
    }
    catch(err:any){
        return res.status(500).send({message:err.name+': '+err.message});
    }
});


/*
 *  List Dashboard Users
 *  List all the users of the Edgeberry Dashboard
 */
router.get('/users/list', async(req:any, res:any)=>{
    // Get the authenticated user
    const user:any = await user_getUserFromCookie(req.cookies.jwt);
    if( !user ) return res.status(403).send({message:'Unauthorized'});
    // Check if the user has admin rights
    if(!user_checkUserForRole(user, "admin"))
    return res.status(403).send({message:'Unauthorized'});


    user_listUsers()
    .then((result)=>{
        return res.send(result);
    })
    .catch((err)=>{
        return res.status(500).send({message:err.toString()});
    })
});


export default router;