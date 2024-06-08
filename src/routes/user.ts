/*
 *  REST API: User Routes
 */
import { Router } from "express";
import { user_activateAccount, user_checkCredentials, user_createNewUser, user_getUserFromCookie, user_updateUserProfile } from "../user";
import * as jwt from 'jsonwebtoken';
const router = Router();

const secret = process.env.JWT_SECRET?process.env.JWT_SECRET:'';
if( secret === '' ) console.error('No secret for the JWT');

/* 
 *  Register new user
 *  
 */
router.post('/register', async(req:any, res:any)=>{
    // Check for the presence of all required data
    if( typeof(req.body) !== 'object' ||
        typeof(req.body.name) !== 'string' ||
        typeof(req.body.email) !== 'string' ||
        typeof(req.body.password) !== 'string')
    return res.status(401).send({message:'Data invalid'});
    // TODO: a lot of checks are ran by the frontend, but we should
    // run more extensive checks here too. Users are dangerous.

    // Create the new user
    user_createNewUser(req.body.email, req.body.password, req.body.name )
    .then((result)=>{
        // TODO: send activation e-mail !!!
        return res.send({message:'success'});
    })
    .catch((err)=>{
        return res.status(500).send({message:err.toString()});
    });
});

/* 
 *  Activate User Account
 *  using the e-mail address and the activation token
 */
router.post('/activate', async(req:any, res:any)=>{
    // Check for the presence of all required data
    if( typeof(req.body) !== 'object' ||
        typeof(req.body.email) !== 'string' ||
        typeof(req.body.token) !== 'string')
    return res.status(401).send({message:'Data invalid'});

    // Activate the useraccount
    user_activateAccount(req.body.email, req.body.token )
    .then((result:any)=>{
        return res.send({message:'success'});
    })
    .catch((err:any)=>{
        return res.status(500).send({message:err.toString()});
    });
});

/* Log in */
router.post('/login', async(req:any, res:any)=>{
    // Check for the presence of all required data
    if( typeof(req.body) !== 'object' ||
        typeof(req.body.email) !== 'string' ||
        typeof(req.body.password) !== 'string')
    return res.status(401).send({message:'Data invalid'});
    
    try{
        const user:any = await user_checkCredentials( req.body.email, req.body.password );
        // Check if the account is active
        if(user.account.M.status.S !== "active")
        return res.status(403).send({message:'Account not active'});

        // Attach a cookie
        // generate a JWT token
        const token = jwt.sign({uid: user.uid.S }, secret );
        // create a cookie, named jwt, the value is the token
        res.cookie('jwt', token, {
            httpOnly: true,             // important for security - the front-end is not able to access the cookie
	        secure: true,		        // only over HTTPS
	        sameSite: true,		        // only send for requests to the same FQDN
            maxAge: 10*24*60*60*1000    // valid for 10 days
        });

        return res.send({message:'success'});
    } catch(err:any){
        return res.status(500).send({message:err.toString()});
    }
});

/*  Log out */
router.post('/logout', (req,res) =>{
    // Destroy the cookie by setting a new one that directly expires
    res.cookie('jwt',' ', {
        httpOnly: true,
        maxAge: 0
    });
    // send a success message with the new cookie
    res.send({message: 'success'});
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

/* Update user profile data */
router.put('/user', async(req:any, res:any)=>{
    // Check for the authenticated user
    const user:any = await user_getUserFromCookie(req.cookies.jwt);
    if( !user ) return res.status(403).send({message:'Unauthorized'});
    // Check for the required parameters
    if( typeof(req.body) !== 'object' || 
        typeof(req.body.username) !== 'string' || 
        typeof(req.body.email) !== 'string')
    return res.status(401).send({message:'Invalid user data'});
    // Update the user profile data
    try{
        await user_updateUserProfile( user.uid, req.body.username, req.body.email );
        return res.send({message:'success'})
    } catch(err:any){
        return res.status(500).send({message:err.toString()});
    }
});

export default router;