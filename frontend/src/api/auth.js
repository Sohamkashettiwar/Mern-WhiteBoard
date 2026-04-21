// frontend/src/api/auth.js
export async function register({ username, email, password }) {
  const res = await fetch("http://localhost:5000/api/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password })
  });
  return res.json();
}

export async function login({ email, password }) {
  const res = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}
