/*
 *  Devices
 */
import { UpdateThingCommand, DescribeThingCommand } from '@aws-sdk/client-iot';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { awsIotClient, dynamoDocumentClient as documentClient, deviceTable } from '.';
import { response } from 'express';


/*
 *  Check Hardware UUID
 *  Check if a device's Hardware UUID is in the database of known
 *  Edgeberry Devices.
 *  Resolves true if a device is known, resolves false if a device
 *  is unknown. Rejects on error.
 */
export function device_checkKnownHardwareId( hardwareId:string ){
    return new Promise<boolean|string>(async(resolve, reject)=>{
        try{
            // Lookup the Device's Hardware UUID in the database of the
            // known (official) Edgeberry devices.
            const command = new ScanCommand({
                TableName: deviceTable,
                FilterExpression:
                    "#uuid = :hardwareid",
                    ExpressionAttributeNames: {
                        "#uuid":"uuid"
                    },
                    ExpressionAttributeValues: {
                        ":hardwareid": hardwareId
                    },
                    ConsistentRead: true
                });
            // Execute the query command
            const response = await documentClient.send(command);
            if( typeof(response.Count) === 'number' && response.Count >= 1 && response.Items )
            return resolve(true);
            else return resolve(false);
        }
        catch(err){
            return reject(err);
        }
    });
}

/*
 *  Check if User is Device owner
 *  Compares the userId with the deviceOwner ID. Resolves 'true' if this
 *  user is the owner, and false if this user is not the owner. Rejection
 *  contains a string with the error message.
 * 
 *  https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/command/DescribeThingCommand/
 */
export function device_checkDeviceOwner( deviceId:string, userId:string ){
    return new Promise<boolean|string>(async(resolve, reject)=>{
    
        // Get the 'Thing description', containing the attributes we've defined
        // in the 'Thing Type'. the deviceOwner ID is in these attributes
        const command = new DescribeThingCommand({thingName:deviceId});
        try{
            const response = await awsIotClient.send( command );
            if( response.attributes?.deviceOwner === userId ){
                return resolve(true);
            }
            return resolve(false);
        }
        catch(err){
            return reject(err);
        }
    });
}

/*
 *  Update device owner
 *  Change a device's owner to the ownerId passed as argument. If no ownerId is passed, 
 *  the device will become ownerless again, and free to be claimed by a user.
 * 
 *  https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/command/UpdateThingCommand/
 */
export function device_updateDeviceOwner( deviceId:string, ownerId?:string ){
    return new Promise(async(resolve, reject)=>{
        // Create the parameters for the Update Thing Command
        const parameters = {
            thingName: deviceId,
            attributePayload:{
                attributes:{
                    deviceOwner: ownerId?ownerId:"unclaimed"
                }
            }
        }
        // Create and execute the Thing update command
        const command = new UpdateThingCommand( parameters );
        try{
            const response = await awsIotClient.send( command );
            return resolve(response);
        }
        catch(err){
            return reject(response);
        }
    })
}
