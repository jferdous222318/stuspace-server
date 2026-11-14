import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const bookings = () => getDB().collection("bookings");
const studios = () => getDB().collection("studios");

const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Overlap: existing.start < new.end AND existing.end > new.start
function findConflict(studioId, date, startTime, endTime, excludeId) {
  const q = {
    studioId, date, status: "Confirmed",
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeId) q._id = { $ne: excludeId };
  return bookings().findOne(q);
}

router.post("/", requireAuth, async (req, res) => {
  const { studioId, date, startTime, endTime, guests, notes } = req.body;
  if (!ObjectId.isValid(studioId)) return res.status(400).json({ message: "Invalid studio" });
  if (!date || !startTime || !endTime)
    return res.status(400).json({ message: "Date, start time and end time are required" });

  const hours = (toMinutes(endTime) - toMinutes(startTime)) / 60;
  if (hours <= 0) return res.status(400).json({ message: "End time must be after start time" });
  if (new Date(`${date}T${startTime}`) < new Date())
    return res.status(400).json({ message: "You cannot book a time in the past" });

  const studio = await studios().findOne({ _id: new ObjectId(studioId) });
  if (!studio) return res.status(404).json({ message: "Studio not found" });
  if (studio.ownerEmail === req.user.email)
    return res.status(400).json({ message: "You cannot book your own studio" });
  if (Number(guests) > studio.maxCapacity)
    return res.status(400).json({ message: `Max capacity is ${studio.maxCapacity} people` });

  if (await findConflict(studioId, date, startTime, endTime))
    return res.status(409).json({
      message: "This time slot is already booked. Please choose a different time.",
    });

  const booking = {
    studioId,
    studioTitle: studio.title,
    studioImage: studio.image,
    studioLocation: studio.location,
    hostEmail: studio.ownerEmail,
    userEmail: req.user.email,
    userName: req.user.name,
    date, startTime, endTime, hours,
    guests: Number(guests) || 1,
    notes: notes || "",
    hourlyRate: studio.hourlyRate,
    securityDeposit: studio.securityDeposit,
    totalPrice: hours * studio.hourlyRate + studio.securityDeposit,
    status: "Pending",
    createdAt: new Date(),
  };
  const { insertedId } = await bookings().insertOne(booking);
  res.status(201).json({ message: "Booking request sent", _id: insertedId });
});

// bookings I made
router.get("/mine", requireAuth, async (req, res) => {
  res.json(await bookings().find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray());
});

// booking requests on my studios (host view)
router.get("/received", requireAuth, async (req, res) => {
  res.json(await bookings().find({ hostEmail: req.user.email }).sort({ createdAt: -1 }).toArray());
});

// guest cancels a Pending booking
router.patch("/:id/cancel", requireAuth, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Booking not found" });
  const b = await bookings().findOne({ _id: new ObjectId(req.params.id) });
  if (!b) return res.status(404).json({ message: "Booking not found" });
  if (b.userEmail !== req.user.email) return res.status(403).json({ message: "Not your booking" });
  if (b.status !== "Pending")
    return res.status(400).json({ message: "Only pending bookings can be cancelled" });
  await bookings().updateOne({ _id: b._id }, { $set: { status: "Cancelled" } });
  res.json({ message: "Booking cancelled" });
});

// host sets Confirmed / Completed / Cancelled
router.patch("/:id/status", requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!["Confirmed", "Completed", "Cancelled"].includes(status))
    return res.status(400).json({ message: "Invalid status" });
  if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Booking not found" });
  const b = await bookings().findOne({ _id: new ObjectId(req.params.id) });
  if (!b) return res.status(404).json({ message: "Booking not found" });
  if (b.hostEmail !== req.user.email) return res.status(403).json({ message: "Not your studio" });

  if (status === "Confirmed") {
    if (await findConflict(b.studioId, b.date, b.startTime, b.endTime, b._id))
      return res.status(409).json({ message: "Conflicts with an already confirmed booking" });
  }
  await bookings().updateOne({ _id: b._id }, { $set: { status } });
  res.json({ message: `Booking ${status.toLowerCase()}` });
});

export default router;