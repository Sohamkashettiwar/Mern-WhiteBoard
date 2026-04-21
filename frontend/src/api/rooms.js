const API = "http://localhost:5000/api/rooms";

export async function createRoom(name, token) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function listRooms(token) {
  const res = await fetch(API, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
