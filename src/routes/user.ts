/*
 *  REST API: Connectivity Routes
 */
import { Router } from "express";
import { user_checkCredentials, user_getUserFromCookie } from "../user";
import * as jwt from 'jsonwebtoken';
const router = Router();

const secret = process.env.JWT_SECRET?process.env.JWT_SECRET:'';

/* Log in */
router.post('/login', async(req:any, res:any)=>{
    // Check for the presence of all required data
    if( typeof(req.body) !== 'object' ||
        typeof(req.body.email) !== 'string' ||
        typeof(req.body.password) !== 'string')
    return res.status(401).send({message:'Data invalid'});
    
    try{
        const user:any = await user_checkCredentials( req.body.email, req.body.password );

        // Attach a cookie
        // generate a JWT token
        const token = jwt.sign({uid: user.uid.S }, secret );
        // create a cookie, named jwt, the value is the token
        res.cookie('jwt', token, {
            httpOnly: true,         // important for security - the front-end is not able to access the cookie
	        secure: true,		    // only over HTTPS
	        sameSite: true,		    // only send for requests to the same FQDN
            maxAge: 2*60*60*1000    // valid for 2 hours
        });

        return res.send({message:'success'});
    } catch(err:any){
        return res.status(500).send({message:err.toString()});
    }
});

/* Get user data */
router.get('/user', async(req:any, res:any)=>{
    try{
        const user = await user_getUserFromCookie(req.cookies.jwt);
        return res.send( user );
    }
    catch(err:any){
        return res.status(500).send({message:err.toString()});
    }
});

/* Update user data */
router.post('/user', async(req:any, res:any)=>{
    if( typeof(req.body) !== 'object' )
    return res.status(401).send({message:'No data'});
    
    try{
        //await cloud.updateConnectionParameters( req.body );
        return res.send({message:'User data successfully updated'})
    } catch(err:any){
        return res.status(500).send({message:err.toString()});
    }
});

export default router;