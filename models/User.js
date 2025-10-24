import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profileImage: { type: String },
    phone: { type: String }, // Phone number
    location: { type: String },
    bio: { type: String }, // Bio for frontend compatibility
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
