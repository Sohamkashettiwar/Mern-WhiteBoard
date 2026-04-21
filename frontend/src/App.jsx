import { useEffect, useRef, useState } from "react";
import { createSocket, getSocket } from "./socket";
import { login, register } from "./api/auth";
import { createRoom, listRooms } from "./api/rooms";
import "./App.css";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [roomId, setRoomId] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [availableRooms, setAvailableRooms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [drawRequests, setDrawRequests] = useState([]);

  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);

  // -------- Fetch Rooms --------
  useEffect(() => {
    if (!token) return;
    (async () => {
      const rooms = await listRooms(token);
      setAvailableRooms(rooms || []);
    })();
  }, [token]);

  // -------- Socket --------
  useEffect(() => {
    if (!token) return;
    const socket = createSocket(token);
    socket.on("connect", () => console.log("✅ Socket connected"));
    socket.on("loadMessages", (msgs) => setMessages(msgs));
    socket.on("receiveMessage", (msg) => setMessages((prev) => [...prev, msg]));
    socket.on("draw", (d) => drawLine(d.x0, d.y0, d.x1, d.y1, false, d.color, d.lineWidth));
    socket.on("clear", () => clearBoard(false));
    socket.on("onlineUsers", (users) => setOnlineUsers(users));
    socket.on("drawRequest", (req) => setDrawRequests((prev) => [...prev, req]));
    socket.on("drawGranted", () => alert("✅ You can now draw!"));
    socket.on("drawDenied", () => alert("❌ Draw request denied."));
    return () => socket.off();
  }, [token]);

  // -------- Canvas Setup --------
  useEffect(() => {
    if (!roomId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctxRef.current = ctx;
  }, [roomId]);

  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = lineWidth;
    }
  }, [color, lineWidth]);

  // -------- Chat --------
  const sendMessage = () => {
    if (!input.trim() || !roomId) return;
    getSocket().emit("sendMessage", { roomId, text: input });
    setInput("");
  };

  // -------- Drawing --------
  const startDrawing = (e) => {
    if (!ctxRef.current) return;

    const user = onlineUsers.find((u) => u.name === username);
    if (!user?.canDraw) return; // 🔒 block if no permission

    drawing.current = true;
    ctxRef.current.lastX = e.nativeEvent.offsetX;
    ctxRef.current.lastY = e.nativeEvent.offsetY;
  };

  const stopDrawing = () => (drawing.current = false);

  const draw = (e) => {
    if (!drawing.current || !ctxRef.current) return;

    const user = onlineUsers.find((u) => u.name === username);
    if (!user?.canDraw) return; // 🔒 block if no permission

    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    drawLine(ctxRef.current.lastX, ctxRef.current.lastY, x, y, true, color, lineWidth);
    ctxRef.current.lastX = x;
    ctxRef.current.lastY = y;
  };

  const drawLine = (x0, y0, x1, y1, emit, strokeColor, strokeWidth) => {
    if (!ctxRef.current) return;
    ctxRef.current.strokeStyle = strokeColor;
    ctxRef.current.lineWidth = strokeWidth;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x0, y0);
    ctxRef.current.lineTo(x1, y1);
    ctxRef.current.stroke();
    ctxRef.current.closePath();

    if (emit && roomId) {
      getSocket().emit("draw", { roomId, x0, y0, x1, y1, color: strokeColor, lineWidth: strokeWidth });
    }
  };

  const clearBoard = (emit = true) => {
    const canvas = canvasRef.current;
    if (!ctxRef.current || !canvas) return;
    ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
    if (emit && roomId) getSocket().emit("clear", { roomId });
  };

  // -------- Auth --------
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newUser, setNewUser] = useState(false);

  const handleAuth = async () => {
    let res;
    if (newUser) {
      res = await register({ username: email.split("@")[0], email, password });
      alert(res.message || res.error);
    } else {
      res = await login({ email, password });
      if (res.token) {
        localStorage.setItem("token", res.token);
        localStorage.setItem("username", res.username);
        setToken(res.token);
        setUsername(res.username);
      } else alert(res.error || "Login failed");
    }
  };

  // -------- UI --------
  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-200">
        <div className="bg-white p-6 rounded shadow-md w-80">
          <h2 className="text-lg font-bold mb-4">{newUser ? "Register" : "Login"}</h2>
          <input className="border p-2 w-full mb-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="border p-2 w-full mb-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={handleAuth} className="bg-blue-500 text-white px-4 py-2 rounded w-full">
            {newUser ? "Register" : "Login"}
          </button>
          <p className="mt-2 text-sm cursor-pointer text-blue-600" onClick={() => setNewUser(!newUser)}>
            {newUser ? "Already have an account? Login" : "No account? Register"}
          </p>
        </div>
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-200">
        <div className="bg-white p-6 rounded shadow-md w-96">
          <h2 className="text-lg font-bold mb-4">Welcome {username}</h2>
          <input className="border p-2 w-full mb-2" placeholder="New Room Name" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} />
          <button
            onClick={async () => {
              const res = await createRoom(roomInput, token);
              if (!res.error) {
                setAvailableRooms((prev) => [res.room, ...prev]);
                getSocket().emit("joinRoom", roomInput);
                setRoomId(roomInput);
              } else alert(res.error);
            }}
            className="bg-green-500 text-white px-4 py-2 rounded w-full mb-4"
          >
            Create & Join Room
          </button>

          <h3 className="font-bold mb-2">Available Rooms</h3>
          <ul>
            {availableRooms.map((r) => (
              <li key={r._id} className="flex justify-between items-center mb-2">
                <span>
                  {r.name} <span className="text-sm text-gray-500">(👑 {r.owner?.username || "Unknown"})</span>
                </span>
                <button
                  onClick={() => {
                    getSocket().emit("joinRoom", r.name);
                    setRoomId(r.name);
                  }}
                  className="bg-blue-500 text-white px-2 py-1 rounded"
                >
                  Join
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // -------- Main UI --------
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Chat & Users */}
      <div className="w-1/3 border-r flex flex-col bg-white shadow-md">
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-lg font-bold mb-3">💬 Chat ({roomId})</h2>
          {messages.map((msg, i) => (
            <div key={i} className="bg-blue-100 text-gray-800 rounded-lg p-2 my-1">
              <span className="font-bold">{msg.sender}</span>
              <span className="text-sm text-gray-500 ml-2">{new Date(msg.createdAt).toLocaleTimeString()}</span>
              <div>{msg.message}</div>
            </div>
          ))}
        </div>
        <div className="p-3 flex border-t">
          <input className="border flex-1 p-2 rounded-l" value={input} placeholder="Type a message..." onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
          <button onClick={sendMessage} className="bg-blue-500 text-white px-4 rounded-r">Send</button>
        </div>

        {/* Online Users */}
        <div className="p-2 text-sm text-gray-700 border-t">
          <h3 className="font-bold mb-2">👥 Online Users</h3>
         <ul>
  {onlineUsers.map((user, i) => (
    <li key={i} className="flex justify-between items-center mb-1">
      <span>
        {user.name}
        {user.isOwner && <span className="text-yellow-600 font-bold"> (👑 Owner)</span>}
        {!user.isOwner && user.canDraw && <span className="text-green-600"> (✏️ Can Draw)</span>}
        {!user.isOwner && !user.canDraw && <span className="text-gray-400"> (👀 Viewer)</span>}
      </span>
      {/* Only show request button if NOT owner AND can't draw */}
      {!user.isOwner && !user.canDraw && user.name === username && (
        <button
          onClick={() => getSocket().emit("requestDraw", roomId)}
          className="text-xs bg-blue-500 text-white px-2 py-1 rounded"
        >
          Request ✏️
        </button>
      )}
    </li>
  ))}
</ul>

        </div>

        {/* Draw Requests (Owner Only) */}
        {drawRequests.length > 0 && onlineUsers.find((u) => u.name === username && u.isOwner) && (
          <div className="p-2 border-t bg-gray-100">
            <h3 className="font-bold mb-1">✏️ Draw Requests</h3>
            {drawRequests.map((req, i) => (
              <div key={i} className="flex justify-between items-center mb-1">
                <span>{req.requesterName}</span>
                <div>
                  <button
                    onClick={() => {
                      getSocket().emit("grantDraw", { roomId, requesterId: req.requesterId });
                      setDrawRequests((prev) => prev.filter((r) => r.requesterId !== req.requesterId));
                    }}
                    className="text-xs bg-green-500 text-white px-2 py-1 rounded mr-1"
                  >
                    Allow
                  </button>
                  <button
                    onClick={() => {
                      getSocket().emit("denyDraw", { roomId, requesterId: req.requesterId });
                      setDrawRequests((prev) => prev.filter((r) => r.requesterId !== req.requesterId));
                    }}
                    className="text-xs bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Whiteboard */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-200">
        <div className="flex gap-3 mb-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          <input type="range" min="1" max="10" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} />
          <button onClick={clearBoard} className="bg-red-500 text-white px-3 py-1 rounded">Clear</button>
        </div>
        <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseUp={stopDrawing} onMouseMove={draw} className="border border-gray-400 w-[95%] h-[90%] bg-white rounded-lg shadow-md" />
      </div>
    </div>
  );
}
