import jwt from "jsonwebtoken";

export const VerifyAdmin = (req, res, next) => {
    try {

        const token = req.headers?.authorization?.split(" ")[1];
        
        if (!token) {
            return res.status(401).json({ message: "Unauthorized" })
        }
        jwt.verify(token, process.env.JWT_SECRET, (err, admin) => {
            if (err) {
                return res.status(401).json({ message: "Unauthorized" })
            }
            req.admin = admin;
            next();
        })
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" })
    }

}
