import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },             
    description: { type: String },                      
    images: { type: [String], required: true },         
    price: { type: Number, required: true },            
    condition: { 
        type: String, 
        enum: ["New", "Used", "Vintage", "Heritage"],  
        required: true 
    },
    category: { type: String, required: true },         
    location: { type: String, required: true },          
user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

export default mongoose.model("Product", productSchema);
