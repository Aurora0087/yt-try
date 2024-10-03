import mongoose, { Schema } from "mongoose";

const forgotPasswordSchema = new Schema({
    owner:{
        type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Owner is required"],
    },
    token:{
        type:String,
        require:true
    },
    expire:{
        type: Date,
        require:true,
        default: () => new Date(Date.now() + 15 * 60 * 1000)
    }
},{timestamps:true});


export const ForgotPassword = mongoose.model("ForgotPassword", forgotPasswordSchema);