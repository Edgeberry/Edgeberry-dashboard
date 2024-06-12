/*
 *  Administration routes
 */

import { Router } from "express";
import { user_getUserFromCookie } from '../user';
const router = Router();

/*
 *  Device onboarding
 *  Adding the device to the Edgeberry ecosystem
 */
router.post('/onboard', async(req:any, res:any)=>{
    // Check for the presence of all required data
    if( typeof(req.body) !== 'object' ||
        typeof(req.body.id) !== 'string' ||
        typeof(req.body.hardwareVersion) !== 'string' ||
        typeof(req.body.batchNumber) !== 'string')
    return res.status(401).send({message:'Data invalid'});

    // Get the authenticated user
    const user:any = await user_getUserFromCookie(req.cookies.jwt);
    if( !user ) return res.status(403).send({message:'Unauthorized'});
    // Check if the user has admin rights
    if(!user.roles?.filter((role:string)=>{role.includes("admin")}))
    return res.status(403).send({message:'Unauthorized'});

    //.then((result)=>{
        // TODO: send activation e-mail !!!
        return res.send({message:'success'});
    /*})
    .catch((err)=>{
        return res.status(500).send({message:err.toString()});
    });*/
});


export default router;