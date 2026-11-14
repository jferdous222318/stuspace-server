import { Router } from "express";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { OAuth2Client } from "google-auth-library";
import { getDB } from "../db.js";
import { requireAuth, signToken, cookieOptions } from "../middleware/auth.js";

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const publicUser = ({ password, ...u }) => u;

function validatePassword(p = "") {
  if (p.length < 6) return "Password must be at least 6 characters";
  if (!/[A-Z]/.test(p)) return "Password must contain an uppercase letter";
  if (!/[a-z]/.test(p)) return "Password must contain a lowercase letter";
  return null;
}

router.post("/register", async (req, res) => {
  const { name, email, photoURL, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "Name, email and password are required" });
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ message: pwError });

  const users = getDB().collection("users");
  const exists = await users.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(409).json({ message: "An account with this email already exists" });

  await users.insertOne({
    name: name.trim(),
    email: email.toLowerCase(),
    photoURL: photoURL || "",
    password: await bcrypt.hash(password, 10),
    provider: "credentials",
    createdAt: new Date(),
  });
  res.status(201).json({ message: "Registration successful" });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await getDB().collection("users").findOne({ email: (email || "").toLowerCase() });
  if (!user || !user.password || !(await bcrypt.compare(password || "", user.password)))
    return res.status(401).json({ message: "Invalid email or password" });

  res.cookie("token", signToken(user), cookieOptions);
  res.json({ user: publicUser(user) });
});

router.post("/google", async (req, res) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: req.body.credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { email, name, picture } = ticket.getPayload();
    const users = getDB().collection("users");
    let user = await users.findOne({ email: email.toLowerCase() });
    if (!user) {
      const { insertedId } = await users.insertOne({
        name, email: email.toLowerCase(), photoURL: picture || "",
        provider: "google", createdAt: new Date(),
      });
      user = await users.findOne({ _id: insertedId });
    }
    res.cookie("token", signToken(user), cookieOptions);
    res.json({ user: publicUser(user) });
  } catch {
    res.status(401).json({ message: "Google authentication failed" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await getDB().collection("users").findOne({ _id: new ObjectId(req.user.id) });
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  res.json({ user: publicUser(user) });
});

router.post("/logout", (req, res) => {
  const { maxAge, ...opts } = cookieOptions;
  res.clearCookie("token", opts);
  res.json({ message: "Logged out" });
});

export default router;