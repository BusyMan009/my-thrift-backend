import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },             
    description: { type: String },                      
    images: { type: [String], required: true },         
    price: { type: Number, required: true },            
    condition: { 
        type: String, 
        enum: ["New", "Used"],  
        required: true 
    },
    category: { type: String, required: true },         
    location: { type: String, required: true },
    phoneNumber: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v) {
                // Saudi phone number validation (starts with +966 or 05)
                return /^(\+966|966|05)[0-9]{8}$/.test(v);
            },
            message: 'Please enter a valid Saudi phone number'
        }
    },
    views: { 
        type: Number, 
        default: 0 
    },          
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    commentCount: { type: Number, default: 0 }

}, { timestamps: true });

export default mongoose.model("Product", productSchema);