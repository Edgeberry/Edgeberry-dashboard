/*
 *  REST API: Connectivity Routes
 */
import { Router } from "express";
const router = Router();

/* Get user data */
router.get('/user', (req:any, res:any)=>{
    return res.send( {user:'spuq'} );
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