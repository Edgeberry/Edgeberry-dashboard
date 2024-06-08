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
        const activationLink = "https://edgeberry.io/dashboard/activate?email="+email+"&token="+token;

        sendEmail( email, "Edgeberry account activation",`
            <html>
                <h1>Hi ${name}!</h1>
                <p>
                    Welcome to the <strong>Edgeberry Dashboard</strong>! To finalize the registration process, click the 
                    activation link to activate your account: <br/>
                    <a href="${activationLink}">Activate account</a>
                <p>
                <p>
                    Kind regards,
                    The Edgeberry Team
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