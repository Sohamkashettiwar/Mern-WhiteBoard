// backend/models/Message.js
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  user: { type: String, required: true },
  text: { type: String, required: true },
  time: { type: String, required: true },
}, { timestamps: true });

export const Message = mongoose.model("Message", messageSchema);
