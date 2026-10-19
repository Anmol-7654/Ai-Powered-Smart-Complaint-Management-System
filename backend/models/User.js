const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        name:{
            type: String,
            required: true,
            trim: true,
        },
        email:{
            type:String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
            minlength:6,
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        phone: {
            type: String,
            default: "",
        },
    },
    {timestamps: true}
);

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = function(candidate){
    return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
    return{
        id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        phone: this.phone,
        createdAt: this.createdAt,
    };
};

module.exports = mongoose.model("User", userSchema);