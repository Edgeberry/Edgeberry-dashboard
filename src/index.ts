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
 */


import express from 'express';
import cors from 'cors';
// API routes
import userRoutes from './routes/user';

/* Express API server */
const app = express();
// Express tools
app.use(express.json());        // JSON API
app.use(cors({origin:'*'}));    // Cross-origin references
// Use the API Routers
app.use('/api/user', userRoutes );
// Start the webserver
app.listen( 8080, ()=>{ console.log('\x1b[32mEdgeBerry Asset Manager backend running on port '+8080+'\x1b[30m')});