/*
 *  Dashboard routes
 */

import { Router } from "express";
import { user_getUserFromCookie } from '../user';
import { awsIotClient } from "..";
import { DescribeCertificateCommand, DescribeEndpointCommand } from "@aws-sdk/client-iot";
const router = Router();

/* 
 *  Get the device Provisioning parameters of the Edgeberry
 *  IoT Core.
 * 
 *  references:
 *          https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/command/DescribeEndpointCommand/
 *          https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/command/DescribeCertificateCommand/
 *          
 *  TODO: Use something like AWS "Secrets Manager" to store the private key, instead of the environment variables.
 */
router.get('/provisioningparameters', async(req:any, res:any)=>{
    try{    
        // Get the authenticated user
        const user:any = await user_getUserFromCookie(req.cookies.jwt);
        if( !user ) return res.status(403).send({message:'Unauthorized'});

        // Get the AWS IoT Core endpoint
        const getEndpointCommand = new DescribeEndpointCommand({endpointType:'iot:Data-ATS'});
        const getEndpointResponse = await awsIotClient.send(getEndpointCommand);

        // Get the AWS IoT Core provisioning (claim) certificate from the certificate ID (environment variables)
        const getProvCertCommand = new DescribeCertificateCommand({certificateId:process.env.AWS_IOT_PROVISIONING_CERT_ID});
        const getProvCertResponse = await awsIotClient.send(getProvCertCommand);

        const parameters = {
            endpoint: getEndpointResponse.endpointAddress,
            certificate: getProvCertResponse.certificateDescription?.certificatePem,
            privateKey: process.env?.AWS_IOT_PROVISIONING_KEY?.replace(/ /g, '\n')    // Private Key is in the environment variables
        }

        return res.send(parameters);
    }
    catch(err:any){
        return res.status(500).send({message:err.name+': '+err.message});
    }
});

export default router;