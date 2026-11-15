import "dotenv/config";
import { connectDB } from "./db.js";

// usage: node seed.js your@email.com   (so you own the sample studios)
const ownerEmail = (process.argv[2] || "host@studiospace.com").toLowerCase();
const db = await connectDB();
const owner = await db.collection("users").findOne({ email: ownerEmail });
const ownerName = owner?.name || "StudioSpace Host";

const sample = [
  ["Aperture Loft", "Photo Studio", 45, 100, 12, "Gulshan 2, Dhaka", 4.8],
  ["White Cyc Wall Studio", "Photo Studio", 60, 150, 20, "Banani, Dhaka", 4.6],
  ["Stage One Cinema Hall", "Film Stage", 120, 300, 50, "Uttara, Dhaka", 4.9],
  ["Echo Podcast Lounge", "Podcast Lounge", 30, 50, 6, "Dhanmondi, Dhaka", 4.7],
  ["Midnight Music Suite", "Music Suite", 40, 80, 8, "Mohammadpur, Dhaka", 4.5],
  ["Clay & Canvas Workshop", "Art Workshop", 25, 40, 15, "Mirpur, Dhaka", 4.4],
  ["Golden Hour Terrace", "Photo Studio", 35, 70, 10, "Bashundhara, Dhaka", 4.3],
  ["Soundwave Recording Room", "Music Suite", 55, 120, 10, "Gulshan 1, Dhaka", 4.6],
];

const docs = sample.map(([title, category, hourlyRate, securityDeposit, maxCapacity, location, rating], i) => ({
  title, category, hourlyRate, securityDeposit, maxCapacity, location, rating,
  image: `https://picsum.photos/seed/studiospace${i + 1}/800/600`,
  gallery: [2, 3, 4].map((n) => `https://picsum.photos/seed/studiospace${i + 1}-${n}/1000/700`),
  amenities: ["Wi-Fi", "Air Conditioning", "Lighting Kit", "Parking"].slice(0, 2 + (i % 3)),
  overview: `${title} is a well-equipped ${category.toLowerCase()} in ${location}. It is ideal for shoots, recordings and workshops, and it fits up to ${maxCapacity} people. Hosts are available for setup help and the space is cleaned between bookings.`,
  ownerEmail, ownerName,
  reviews: [
    { name: "Rafi A.", rating: 5, comment: "Clean space and a very helpful host. We will book again.", date: new Date() },
    { name: "Nusrat K.", rating: 4, comment: "Great lighting and easy booking. Parking was a little tight.", date: new Date() },
  ],
  createdAt: new Date(Date.now() - i * 3600 * 1000),
}));

await db.collection("studios").insertMany(docs);
console.log(`Added ${docs.length} studios for ${ownerEmail}`);
process.exit(0);