import express from "express";
import jwt from "jsonwebtoken";
import Room from "../models/Room.js";
import User from "../models/User.js";

const router = express.Router();

// Middleware: auth check
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Create room
router.post("/", auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Room name required" });

    const exists = await Room.findOne({ name });
    if (exists) return res.status(400).json({ error: "Room already exists" });

    const room = new Room({ name, owner: req.user.id });
    await room.save();
    const owner = await User.findById(req.user.id).select("username email");

    res.json({ message: "Room created", room: { ...room._doc, owner } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List rooms (with owner info)
router.get("/", auth, async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate("owner", "username email")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
