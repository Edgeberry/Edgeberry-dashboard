/*
 *  Edgeberry Dashboard
 *  An asset management platform for Edgeberry devices
 * 
 *  Copyright 2024 Sanne 'SpuQ' Santens
 * 
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program. If not, see <https://www.gnu.org/licenses/>.
 * 
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';  // parse cookies from requests
// DynamoDB Client
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
// IoT Core Client
import { IoTClient } from '@aws-sdk/client-iot';
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane';
// API routes
import userRoutes from './routes/user';
import thingRoutes from './routes/things';

/* 
 *  Express API server
 */
const app = express();
// Express tools
app.use(express.json());        // JSON API
app.use(cors({origin:'*'}));    // Cross-origin references
app.use(cookieParser());        // for the cookies (jwt)
// Use the API Routers
app.use('/api/user', userRoutes );
app.use('/api/things', thingRoutes );
// Serve the public directory and a static HTML index file
app.use(express.static( __dirname+'/public/'));
app.get('*', (req:any, res:any)=>{
    return res.sendFile('index.html',{ root: __dirname+'/public' });
});
// Start the webserver
app.listen( 8081, ()=>{ console.log('\x1b[32mEdgeBerry Asset Manager backend running on port '+8081+'\x1b[30m')});


/*
 *  DynamoDB Client
 */
let dynamoClient;

if( process.env.DYNAMO_CONF ){
    console.log("Initializing DynamoDB client for development");
    dynamoClient = new DynamoDBClient(JSON.parse((process.env.DYNAMO_CONF).toString()));
}
else{
    dynamoClient = new DynamoDBClient({region: 'eu-north-1'});
}

// DynamoDB document client
export const dynamoDocumentClient = DynamoDBDocumentClient.from(dynamoClient);

/*
 *  AWS IoT Core Client
 */
// Shadow name for the named device shadow
export const edgeberryShadowName = 'edgeberry-device';

let awsConfig:any;

if( process.env.IOTCORE_CONF ){
    console.log("Initializing IoT Core client for development");
    awsConfig = JSON.parse((process.env.IOTCORE_CONF).toString())
}
else{
    awsConfig = {region: 'eu-north-1'};
}

// Create the IoT Core client
export const awsIotClient = new IoTClient( awsConfig );
// Create a new Data Plane client
export const awsDataPlaneClient = new IoTDataPlaneClient( awsConfig );
