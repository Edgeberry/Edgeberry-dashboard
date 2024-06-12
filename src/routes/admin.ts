/*
 *  Administration routes
 */

import { Router } from "express";
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { user_getUserFromCookie } from '../user';
import { dynamoDocumentClient as documentClient } from '..';
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
    if(!user.roles?.filter((role:string)=>{role.includes("admin")}))
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


export default router;