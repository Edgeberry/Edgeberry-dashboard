/*
 *  E-mail
 *  Send e-mails from the Edgeberry Dashboard using AWS SES, for example
 *  for account activation.
 * 
 *  resources:
 *      https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/ses-examples-sending-email.html
 *      https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
 */

import { SendEmailCommand, SendEmailCommandInput } from "@aws-sdk/client-ses";
import { awsSesClient } from ".";
const sender = "noreply@edgeberry.io";

/*
 *  Send e-mail
 */
function sendEmail( receiver:string, subject:string, htmlBody:string ){
    return new Promise((resolve, reject)=>{
        // Create the send e-mail command settings
        const settings:SendEmailCommandInput = {
            Destination:{
                ToAddresses:[ receiver ]
            },
            Source: sender,
            Message:{
                Subject:{
                    Charset:"UTF-8",
                    Data: subject
                },
                Body:{
                    Html:{
                        Charset:"UTF-8",
                        Data: htmlBody
                    }
                }
            }
        }
        // Create the send e-mail command
        const sendEmailCommand = new SendEmailCommand(settings);
        try{
            awsSesClient.send(sendEmailCommand)
            .then(()=>{
                return resolve('success');
            })
            .catch((err)=>{
                return reject(err);
            });
        } catch(err){
            return reject(err);
        }
    });
}

/*
 *  Send activation e-mail
 */
export function email_activateAccount( email:string, name:string, token:string ){
    return new Promise((resolve, reject)=>{
        // Create the activation link
        const activationLink = "https://dashboard.edgeberry.io/activate?email="+email+"&token="+token;

        sendEmail( email, "Edgeberry Dashboard account activation",`
            <html>
                <h2>Hi ${name}!</h2>
                <p>
                    Welcome to the <strong>Edgeberry Dashboard</strong>! To finalize the registration process, click the 
                    activation link to activate your account: <br/>
                    <a href="${activationLink}">Activate account</a>
                </p>
                <p>
                    Best regards,<br/>
                    <strong style="color:#0e0e0e">The Edgeberry Team</strong>
                </p>
            </html>
        `)
        .then(()=>{
            return resolve('success');
        })
        .catch((err)=>{
            return reject(err);
        });
    });
}


/*
 *  Send deletion e-mail
 */
export function email_deleteAccount( email:string, name:string ){
    return new Promise((resolve, reject)=>{

        sendEmail( email, "Edgeberry Dashboard account deletion",`
            <html>
                <h2>Hi ${name}!</h2>
                <p>
                    We're sorry to see you leave the <strong>Edgeberry Dashboard</strong>. Whenever you need us, you are always welcome
                    to create a new account! Following actions have been taken:
                    <ul>
                        <li>Your account and all your personal data has been removed from our systems</li>
                        <li>Your devices have been released, and can be reclaimed</li>
                    </ul>
                </p>
                <p>
                    Best regards,<br/>
                    <strong style="color:#0e0e0e">The Edgeberry Team</strong>
                </p>
            </html>
        `)
        .then(()=>{
            return resolve('success');
        })
        .catch((err)=>{
            return reject(err);
        });
    });
}