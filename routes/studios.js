import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const col = () => getDB().collection("studios");
const validId = (id) => ObjectId.isValid(id);

function buildStudio(body) {
  return {
    title: String(body.title || "").trim(),
    category: body.category,
    hourlyRate: Number(body.hourlyRate),
    securityDeposit: Number(body.securityDeposit || 0),
    maxCapacity: Number(body.maxCapacity),
    location: String(body.location || "").trim(),
    image: body.image,
    gallery: Array.isArray(body.gallery) ? body.gallery : [],
    amenities: Array.isArray(body.amenities) ? body.amenities : [],
    overview: String(body.overview || "").trim(),
  };
}

function checkStudio(s) {
  if (!s.title || !s.category || !s.location || !s.image || !s.overview)
    return "Please fill in all required fields";
  if (!(s.hourlyRate > 0)) return "Hourly rate must be greater than 0";
  if (!(s.maxCapacity > 0)) return "Max capacity must be greater than 0";
  return null;
}

// GET /api/studios?category=&search=&sort=&limit=
router.get("/", async (req, res) => {
  const { category, search, sort, limit } = req.query;
  const filter = {};
  if (category && category !== "All") filter.category = category;
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: rx }, { location: rx }];
  }
  const sorts = {
    newest: { createdAt: -1 },
    rating: { rating: -1, createdAt: -1 },
    priceLow: { hourlyRate: 1 },
    priceHigh: { hourlyRate: -1 },
  };
  let cursor = col().find(filter).sort(sorts[sort] || sorts.newest);
  if (limit) cursor = cursor.limit(Math.min(Number(limit) || 6, 50));
  res.json(await cursor.toArray());
});

// must be before /:id
router.get("/mine", requireAuth, async (req, res) => {
  res.json(await col().find({ ownerEmail: req.user.email }).sort({ createdAt: -1 }).toArray());
});

router.get("/:id", async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: "Studio not found" });
  const studio = await col().findOne({ _id: new ObjectId(req.params.id) });
  if (!studio) return res.status(404).json({ message: "Studio not found" });
  res.json(studio);
});

router.post("/", requireAuth, async (req, res) => {
  const studio = buildStudio(req.body);
  const err = checkStudio(studio);
  if (err) return res.status(400).json({ message: err });
  const doc = {
    ...studio,
    ownerEmail: req.user.email, // taken from the JWT, never from the client
    ownerName: req.user.name,
    rating: 0,
    reviews: [],
    createdAt: new Date(),
  };
  const { insertedId } = await col().insertOne(doc);
  res.status(201).json({ message: "Studio added", _id: insertedId });
});

router.put("/:id", requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: "Studio not found" });
  const studio = await col().findOne({ _id: new ObjectId(req.params.id) });
  if (!studio) return res.status(404).json({ message: "Studio not found" });
  if (studio.ownerEmail !== req.user.email)
    return res.status(403).json({ message: "You can only edit your own listings" });

  const updated = buildStudio(req.body);
  const err = checkStudio(updated);
  if (err) return res.status(400).json({ message: err });
  await col().updateOne({ _id: studio._id }, { $set: { ...updated, updatedAt: new Date() } });
  res.json({ message: "Studio updated" });
});

router.delete("/:id", requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: "Studio not found" });
  const studio = await col().findOne({ _id: new ObjectId(req.params.id) });
  if (!studio) return res.status(404).json({ message: "Studio not found" });
  if (studio.ownerEmail !== req.user.email)
    return res.status(403).json({ message: "You can only delete your own listings" });
  await col().deleteOne({ _id: studio._id });
  res.json({ message: "Studio deleted" });
});

export default router;