/*
 *  User related operations
 */

import { DynamoDBClient, ScanCommand  } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcryptjs';             // for password encryption (hashing with a salt)
import * as jwt from 'jsonwebtoken';

const userTable = 'edgeberry-io-users';

// DynamoDB client
const dynamoClient = new DynamoDBClient({
    region: 'eu-north-1'
});
// DynamoDB document client
const documentClient = DynamoDBDocumentClient.from(dynamoClient);

/* Encrypt */
export async function encryptData( value:string ){
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash( value, salt);
    return hashedPassword;
}


/* Create a new user */
export async function user_createNewUser( email:string, password:string, username:string ){
    return new Promise( async(resolve, reject)=>{
        // check if the e-mail address is already in the database, because this uniquely
        // identifies this user account.
        const user:any = await user_findByEmail( email )
            .catch(()=>{
                return reject('Lookup failed');
            });
        // If a user with this e-mail is found, reject
        if( user ) return reject('E-mail already registered');

        // Create the command to create the new user
        const command = new PutCommand({
            TableName: userTable,
            Item:{
                uid: crypto.randomUUID(),
                username: username,
                email: email,
                password: await encryptData(password)
            }
        });

        try{
            const response = await documentClient.send(command);
            return resolve(response);
        }
        catch(err){
            return reject(err);
        }
    })
}


/* Get User's AWS credentials */
export function user_getAwsCredentials( uid:string ){
    return new Promise( async(resolve, reject)=>{
        // Create the query command
        const command = new ScanCommand({
            TableName: userTable,
            FilterExpression:
              "uid = :id",
            ExpressionAttributeValues: {
              ":id": {"S":uid}
            },
            ConsistentRead: true,
            Limit: 1                        // limit the query to 1 result
          });
        // Execute the query command
        try{
            const response:any = await documentClient.send(command);
            if( typeof(response.Count) === 'number' && response.Count >= 1 && response.Items ){
                console.log(response.Items[0]);
                const credentials = {
                    endpoint: response.Items[0].credentials.M.endpoint.S,
                    region: response.Items[0].credentials.M.region.S,
                    accessKeyId: response.Items[0].credentials.M.accessKeyId.S,
                    secretAccessKey: response.Items[0].credentials.M.secretAccessKey.S
                }
                console.log(credentials);
                return resolve(credentials);
            }
            else return resolve(null);
        }
        catch(err){
            return reject(err);
        }
    })
}


/* Update User's AWS credentials */
export function user_updateAwsCredentials( uid:string, endpoint:string, region:string, accessKeyId:string, secretAccessKey:string ){
    return new Promise( async(resolve, reject)=>{
        // Check for the user's existence
        const user = await user_findById( uid ).catch((err)=>{return reject(err)});
        if( !user ) return reject('User does not exist');

        // Create the command to update the user's AWS credentials
        const command = new UpdateCommand({
            TableName: userTable,
            Key:{
                uid:uid
            },
            UpdateExpression:'set credentials = :credentials',
            ExpressionAttributeValues: {
                ':credentials':{
                    endpoint: endpoint,
                    region: region,
                    accessKeyId: accessKeyId,
                    secretAccessKey: secretAccessKey
                }
            }
        });

        try{
            const response = await documentClient.send(command);
            console.log(response);
            return resolve(response);
        }
        catch(err){
            return reject(err);
        }
    })
}

/* Find user by e-mail address */
async function user_findByEmail( email:string ){
    return new Promise(async(resolve, reject)=>{
        // Create the query command
        const command = new ScanCommand({
            TableName: userTable,
            FilterExpression:
              "email = :email",
            ExpressionAttributeValues: {
              ":email": {"S":email}
            },
            ConsistentRead: true,
            Limit: 1                        // limit the query to 1 result
          });
        // Execute the query command
        try{
            const response = await documentClient.send(command);
            if( typeof(response.Count) === 'number' && response.Count >= 1 && response.Items ){
                return resolve(response.Items[0]);
            }
            else{
                return resolve(null);
            }
        }
        catch(err){
            return reject(err);
        }
    });
}

/* Find user by e-mail address */
async function user_findById( id:string ){
    return new Promise(async(resolve, reject)=>{
        // Create the query command
        const command = new ScanCommand({
            TableName: userTable,
            FilterExpression:
              "uid = :id",
            ExpressionAttributeValues: {
              ":id": {"S":id}
            },
            ConsistentRead: true,
            Limit: 1                        // limit the query to 1 result
          });
        // Execute the query command
        try{
            const response = await documentClient.send(command);
            if( typeof(response.Count) === 'number' && response.Count >= 1 && response.Items )
            return resolve(response.Items[0]);
            else return resolve(null);
        }
        catch(err){
            return reject(err);
        }
    });
}


/* Check user credentials */
export function user_checkCredentials( email:string, password:string ){
    return new Promise( async(resolve, reject)=>{
        // Find the user by e-mail
        const user:any = await user_findByEmail( email )
        .catch(()=>{
            return reject('Lookup failed');
        });
        // If no user with this e-mail is found, reject
        if( !user ) return reject('E-mail does not exist');

        // Compare the passwords
        if( !await bcrypt.compare( password, user.password.S ) )
        return reject('Password incorrect');

        // If we got here, credentials check out
        return resolve( user );
    });
}

export function user_getUserFromCookie( cookie:any ){
    return new Promise( async(resolve, reject) =>{
        try{
            if( !cookie ) return reject('No cookie');                                               // if there is no JWT cookie, no user.
            const claims = jwt.verify(cookie, process.env.JWT_SECRET?process.env.JWT_SECRET:'');    // retreive user userID from the cookie
            if( !claims || typeof(claims) !== 'object' ) return reject('No claims from cookie')     // if no claims were made, no user
            if( typeof(claims.uid) !== 'string') return reject('No ID in cookie');                  // if no userID was in claims, no user
            const user:any|null = await user_findById( claims.uid );                                         // get the user info from the database by the userID claimed from the cookie
            if( !user ) reject('No user with this ID');                                             // if there was no user found with this _id, no user

            // Format user
            const formattedUser = {
                uid: user.uid.S,
                username: user.username.S,
                email: user.email.S
            }

            resolve(formattedUser);
        }
        catch(err){
            return reject(err);
        }
    });
}