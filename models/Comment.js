import mongoose from "mongoose";
import Product from "./Product.js";

const commentSchema = new mongoose.Schema(
    {

    text: {
        type:String,
        required: true,
        trim:true
    },

    User: {
        type : mongoose.Schema.Types.ObjectId,
        ref: "User",
        required:true
    },

    Product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required:true
    }
},
{timestamps:true}
);

const comment = mongoose.model("Comment",commentSchema);
export default comment;