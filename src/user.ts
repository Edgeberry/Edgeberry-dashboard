/*
 *  User related operations
 */
import { dynamoDocumentClient as documentClient } from '.';
import { DeleteItemCommand, ScanCommand  } from '@aws-sdk/client-dynamodb';
import { PutCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcryptjs';             // for password encryption (hashing with a salt)
import * as jwt from 'jsonwebtoken';
import { email_activateAccount, email_deleteAccount } from './email';

const userTable = 'edgeberry-io-users';

/*
 *  User database object
 *  All the information in the right format as it should
 *  be in the DynamoDB database. Note that we are only using
 *  one layer of nesting (!)
 */
export interface User{
    uid: string;                // The unique ID of this user
    profile:{
        name: string;           // The name of the user
        email: string;          // The user's e-mail address
        password: string;       // The encrypted user password
    },
    account:{
        roles: [string];         // Platform role (e.g. user, admin, ...)
        status: string;         // Current account status (active/inactive/unactivated/suspended)
        token?: string;         // Token for activating account, resetting password, ...
        lastActiveDate: number; // The moment the user was last active (timestamp)
        creationDate: number;   // The moment the account was created (timestamp)
    }
}

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
        // identifies this user.
        const user:any = await user_findByEmail( email )
            .catch(()=>{
                return reject('Lookup failed');
            });
        // If a user with this e-mail is found, reject
        if( user ) return reject('E-mail already exists');

        // Generate an activation token
        const activationToken = (Math.random()).toString(36).substring(2);

        // Create the new user object
        const newUser:User = {
            uid: crypto.randomUUID(),
            profile:{
                name: username,
                email: email,
                password: await encryptData(password)
            },
            account:{
                roles:["user"],
                status: "unactivated",
                lastActiveDate: Date.now(),
                creationDate: Date.now(),
                token: activationToken
            }
        }

        // Create the command to create the new user
        const command = new PutCommand({
            TableName: userTable,
            Item:newUser
        });

        try{
            // Create the user account in the database
            const response = await documentClient.send(command);
            // Send the activation e-mail to the user's e-mail address
            email_activateAccount(email, username, activationToken);

            return resolve(response);
        }
        catch(err){
            return reject(err);
        }
    })
}

/*
 *  Activate user account
 *  with e-mail address and token
 */
export async function user_activateAccount( email:string, token:string ){
    return new Promise( async(resolve, reject)=>{
        // check if the e-mail address is already in the database, because this uniquely
        // identifies this user.
        const user:any = await user_findByEmail( email )
            .catch(()=>{
                return reject('Lookup failed');
            });
        // If no user with this e-mail is found, reject
        // neutral error message for user protection
        if( !user ) return reject('Invalid activation attempt');
        
        // Compare the activation tokenstomer action completed
        // neutral error message for user protection
        if( user.account.M.token.S !== token )
        return reject('Invalid activation attempt');

        // Update the account state to active
        // and erase the activation token
        const command = new UpdateCommand({
            TableName: userTable,
            Key:{
                uid:user.uid.S
            },
            UpdateExpression:'set account.#status = :newStatus, account.#token = :newToken',
            ConditionExpression: 'account.#status = :expectedStatus',   // TODO: condition not working as expected...?
            ExpressionAttributeNames: {     // 'status' and 'token' are reserved key words
                '#status': 'status',        // so we use '#status' and '#token', and we change
                '#token':'token'            // it to their actual keys using ExpressionAttributeNames
            },
            ExpressionAttributeValues: {
                ':newStatus': 'active',
                ':newToken':'',
                ':expectedStatus': 'unactivated'
            }
        });

        try{
            const response = await documentClient.send(command);
            return resolve(response);
        }
        catch(err:any){
            if(err.name === "ConditionalCheckFailedException"){
                // We erase the token, so we shouldn't get here
                return reject("Account is already activated");
            }
            return reject(err);
        }
    });
}

/*
 *  Update user profile
 */
export function user_updateUserProfile( uid:string, name:string, email:string ){
    return new Promise( async(resolve, reject)=>{
        // check if the e-mail address is already in the database, because this uniquely
        // identifies this user.
        const user:any = await user_findByEmail( email )
            .catch(()=>{
                return reject('Lookup failed');
            });
        // If a user with this e-mail is found, other than this user,
        // reject
        if( user && user.uid.S !== uid ) return reject('E-mail already in use');

        // Update the account state to active
        // and erase the activation token
        const command = new UpdateCommand({
            TableName: userTable,
            Key:{
                uid:uid
            },
            UpdateExpression:'set profile.#name = :newName, profile.#email = :newEmail',
            ExpressionAttributeNames: {
                '#name': 'name',
                '#email':'email'
            },
            ExpressionAttributeValues: {
                ':newName': name,
                ':newEmail': email
            }
        });

        try{
            const response = await documentClient.send(command);
            return resolve(response);
        }
        catch(err:any){
            return reject(err);
        }
    });
}

/*
 *  Delete user account
 *  Delete this user and release all its assets.
 *  
 *  https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/dynamodb/command/DeleteItemCommand/
 */
export function user_deleteUserProfile( uid:string ){
    return new Promise( async(resolve, reject)=>{
        const user:any = await user_findById( uid );
        if( !user ) return reject("User not found");

        // TODO: release all devices owned by
        // this user

        // Delete the account from the database
        const command = new DeleteItemCommand({
            TableName: userTable,
            Key:{
                uid:{
                    S: uid
                }
            }
        });

        try{
            const response = await documentClient.send(command);
            email_deleteAccount( user.profile.M.email.S, user.profile.M.name.S )
            return resolve(response);
        }
        catch(err:any){
            return reject(err);
        }
    });
}




/*
 *  Update password
 */
export function user_updateUserPassword( uid:string, password:string, newPassword:string ){
    return new Promise( async(resolve, reject)=>{
        // Get the user
        const user:any = await user_findById( uid )
        .catch(()=>{
            return reject('User lookup failed');
        });

        // Compare the passwords
        if( !await bcrypt.compare( password, user.profile.M.password.S ) )
        return reject('Old Password is incorrect');

        // Update the new password
        const command = new UpdateCommand({
            TableName: userTable,
            Key:{
                uid:uid
            },
            UpdateExpression:'set profile.password = :newPassword',
            ExpressionAttributeValues: {
                ':newPassword': await encryptData(newPassword)
            }
        });

        try{
            const response = await documentClient.send(command);
            return resolve(response);
        }
        catch(err:any){
            return reject(err);
        }
    });
}

/* Get User's AWS credentials */
/* OBSOLETE - keeping these as example for now
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
                const credentials = {
                    endpoint: response.Items[0].credentials.M.endpoint.S,
                    region: response.Items[0].credentials.M.region.S,
                    accessKeyId: response.Items[0].credentials.M.accessKeyId.S,
                    secretAccessKey: response.Items[0].credentials.M.secretAccessKey.S
                }
                return resolve(credentials);
            }
            else return resolve(null);
        }
        catch(err){
            return reject(err);
        }
    })
}
*/

/* Update User's AWS credentials */
/* OBSOLETE
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
            return resolve(response);
        }
        catch(err){
            return reject(err);
        }
    })
}
*/

/*
 *  ADMIN: List all users
 *  
 */
export async function user_listUsers(){
    return new Promise(async(resolve, reject)=>{
        // Create the query command
        const command = new ScanCommand({
            TableName: userTable,
            ConsistentRead: true
          });
        // Execute the query command
        try{
            const response = await documentClient.send(command);
            if( typeof(response.Count) === 'number' && response.Count >= 1 && response.Items ){
                return resolve(response.Items);
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
async function user_findByEmail( email:string ){
    return new Promise(async(resolve, reject)=>{
        // Create the query command
        const command = new ScanCommand({
            TableName: userTable,
            FilterExpression:
              "profile.email = :email",     // E-mail is nested in 'profile'
            ExpressionAttributeValues: {
              ":email": {"S":email}
            },
            ConsistentRead: true
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
            ConsistentRead: true
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
        if( !await bcrypt.compare( password, user.profile.M.password.S ) )
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
            const user:any|null = await user_findById( claims.uid );                                // get the user info from the database by the userID claimed from the cookie
            if( !user ) reject('No user with this ID');                                             // if there was no user found with this _id, no user

            // Format user
            const formattedUser = {
                uid: user.uid.S,
                username: user.profile.M.name.S,
                email: user.profile.M.email.S,
                roles: user.account.M.roles.L.map((role:any)=>{return role.S })
            }

            resolve(formattedUser);
        }
        catch(err){
            return reject(err);
        }
    });
}