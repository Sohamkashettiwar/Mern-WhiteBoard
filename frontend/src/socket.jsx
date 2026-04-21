// frontend/src/socket.jsx
import { io } from "socket.io-client";

let socket = null;

export function createSocket(token) {
  // if existing socket, disconnect first
  if (socket) socket.disconnect();

  socket = io("http://localhost:5000", {
    autoConnect: false,
    auth: { token }, // token optional
  });
  socket.connect();
  return socket;
}

export function getSocket() {
  return socket;
}
