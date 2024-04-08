/*
 *  EdgeBerry Asset Manager
 *  An application for managing your EdgeBerry Assets in the cloud
 * 
 *  Copyright 2024, Sanne 'SpuQ' Santens
 * 
 *  THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT 
 *  LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
 *  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
 *  WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
 *  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * 
 * 
 *  resources:
 *      https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_nodejs.html
 */


import express from 'express';
import cors from 'cors';
// API routes
import userRoutes from './routes/user';
// AWS SDK
import { IoTClient, ListThingsCommand } from '@aws-sdk/client-iot';


/* Express API server */
const app = express();
// Express tools
app.use(express.json());        // JSON API
app.use(cors({origin:'*'}));    // Cross-origin references
// Use the API Routers
app.use('/api/user', userRoutes );
// Start the webserver
app.listen( 8080, ()=>{ console.log('\x1b[32mEdgeBerry Asset Manager backend running on port '+8080+'\x1b[30m')});

/*
 *  AWS IoT Client
 *
 *  Resources:
 *      getting started: AWS CLI:       https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
 *                       Credentials:   https://docs.aws.amazon.com/cli/latest/userguide/cli-authentication-user.html
 *                       
 * 
 *      credentials:     https://docs.aws.amazon.com/rekognition/latest/dg/setup-awscli-sdk.html
 *                       https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/getting-started-nodejs.html#getting-started-nodejs-credentials
 *                       https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html
 * 
 *      SDK info (!):    https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot/
 *                       https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/iot-data-plane/
 *                       https://docs.aws.amazon.com/iot/latest/apireference/API_Operations.html
 */


const iotClientConfig = {
    region: 'eu-north-1'
}

const AWSIoTClient = new IoTClient( iotClientConfig );


async function listThings(){
    try{
        const command = new ListThingsCommand( {maxResults:20} );
        const response = await AWSIoTClient.send( command );
        console.log(response);
    }
    catch(err){
        console.log(err)
    }
}
listThings();