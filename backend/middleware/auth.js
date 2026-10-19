const  jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    try{
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith("Bearer ")){
            return res.status(401).json({message: "Unauthorized: No token provided"});
        }
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");
        if(!user){
            return res.status(401).json({message: "Unauthorized: User not found"});
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({message: "Unauthorized: Invalid token"});
    }
};

const adminOnly = (req, res, next) => {
    if(req.user && req.user.role === "admin"){
     return next();
    }
    return res.status(403).json({message: "Admin access reuired"});
};

module.exports = {protect, adminOnly};