/*
 *  User related operations
 */

import { DynamoDBClient, ScanCommand  } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand} from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcryptjs';             // for password encryption (hashing with a salt)
import * as jwt from 'jsonwebtoken';

const userTable = 'edgeberry-io-users';

// DynamoDB client
const dynamoClient = new DynamoDBClient({
    region: 'eu-north-1'
});
// DynamoDB document client
const documentClient = DynamoDBDocumentClient.from(dynamoClient);

/* Encrypt
 * Encrypt Password before storing in database
 */
export async function encryptValue( value:string ){
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
        console.log(user);
        if( user ) return reject('E-mail already registered');

        // Create the command to create the new user
        const command = new PutCommand({
            TableName: userTable,
            Item:{
                uid: crypto.randomUUID(),
                username: username,
                email: email,
                password: await encryptValue(password)
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
            console.log(response)
            if( typeof(response.Count) === 'number' && response.Count >= 1 && response.Items ){
                return resolve(response.Items[0]);
            }
            else{
                return resolve(null);
            }
            return reject('Something was not right...');
        }
        catch(err){
            console.log(err);
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
            console.log(response)
            if( typeof(response.Count) === 'number' && response.Count >= 1 && response.Items ){
                return resolve(response.Items[0]);
            }
            else{
                return resolve(null);
            }
            return reject('Something was not right...');
        }
        catch(err){
            console.log(err);
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