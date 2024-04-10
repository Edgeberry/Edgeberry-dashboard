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
 *      https://github.com/marketplace/actions/beanstalk-deploy
 */


import express from 'express';
import cors from 'cors';
// API routes
import userRoutes from './routes/user';
import thingRoutes from './routes/things';


/* Express API server */
const app = express();
// Express tools
app.use(express.json());        // JSON API
app.use(cors({origin:'*'}));    // Cross-origin references
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
