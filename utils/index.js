export const VerifyAdmin=(req,res,next)=>{
    try {
        const admintoken=req.cookies.admintoken;
        if(!admintoken){
            return res.status(401).json({message:"Unauthorized"})
        }
        jwt.verify(admintoken,process.env.ADMIN_SECRET_KEY,(err,admin)=>{
            if(err){
                return res.status(401).json({message:"Unauthorized"})
            }
            req.admin=admin;
            next();
        })
    } catch (error) {
        res.status(500).json({message:"Internal Server Error"})
    }
    
}
