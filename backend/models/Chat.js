// backend/models/Chat.js
import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  sender:    { type: String, required: true }, // username
  message:   { type: String, required: true },
  roomId:    { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("Chat", chatSchema);
