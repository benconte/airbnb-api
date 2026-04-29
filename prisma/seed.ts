import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"] as string,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Clean existing data (children before parents)
  await prisma.booking.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  console.log("🧹 Cleaned existing data");

  // 2. Create users
  const hashedPassword = await bcrypt.hash("password123", 10);

  const [host1, host2] = await Promise.all([
    prisma.user.create({
      data: {
        name: "admin",
        email: "admin@gmail.com",
        username: "admin",
        phone: "+1-555-101-0001",
        password: hashedPassword,
        role: "ADMIN",
        bio: "Am an admin",
      },
    }),
    prisma.user.create({
      data: {
        name: "Alice Johnson",
        email: "alice@example.com",
        username: "alice_host",
        phone: "+1-555-101-0001",
        password: hashedPassword,
        role: "HOST",
        bio: "Superhost with 5 years of experience. I love welcoming guests!",
      },
    }),
    prisma.user.create({
      data: {
        name: "Bob Smith",
        email: "bob@example.com",
        username: "bob_host",
        phone: "+1-555-101-0002",
        password: hashedPassword,
        role: "HOST",
        bio: "Property enthusiast offering premium stays across the country.",
      },
    }),
  ]);

  const [guest1, guest2, guest3] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Carol White",
        email: "carol@example.com",
        username: "carol_guest",
        phone: "+1-555-202-0001",
        password: hashedPassword,
        role: "GUEST",
      },
    }),
    prisma.user.create({
      data: {
        name: "David Brown",
        email: "david@example.com",
        username: "david_guest",
        phone: "+1-555-202-0002",
        password: hashedPassword,
        role: "GUEST",
      },
    }),
    prisma.user.create({
      data: {
        name: "Eva Martinez",
        email: "eva@example.com",
        username: "eva_guest",
        phone: "+1-555-202-0003",
        password: hashedPassword,
        role: "GUEST",
      },
    }),
  ]);

  console.log("👤 Created 2 hosts and 3 guests");

  const [apartment, villa, cabin] = await Promise.all([
    prisma.listing.create({
      data: {
        title: "Cozy Downtown Apartment",
        description: "A modern apartment in the heart of the city with stunning skyline views.",
        type: "APARTMENT",
        location: "New York, USA",
        pricePerNight: 120,
        guests: 2,
        amenities: ["WiFi", "Air Conditioning", "Kitchen"],
        rating: 4.7,
        hostId: host1.id,
        photos: {
          create: [
            {
              url: "https://res.cloudinary.com/demo/image/upload/apartment_main.jpg",
              publicId: "listings/apartment_main",
            },
            {
              url: "https://res.cloudinary.com/demo/image/upload/apartment_living.jpg",
              publicId: "listings/apartment_living",
            },
          ],
        },
      },
    }),
    prisma.listing.create({
      data: {
        title: "Charming Suburban House",
        description: "A spacious family home with a large backyard, perfect for groups.",
        type: "HOUSE",
        location: "Austin, USA",
        pricePerNight: 200,
        guests: 6,
        amenities: ["WiFi", "Parking", "BBQ Grill", "Washer/Dryer"],
        rating: 4.5,
        hostId: host1.id,
        photos: {
          create: [
            {
              url: "https://res.cloudinary.com/demo/image/upload/house_main.jpg",
              publicId: "listings/house_main",
            },
            {
              url: "https://res.cloudinary.com/demo/image/upload/house_backyard.jpg",
              publicId: "listings/house_backyard",
            },
          ],
        },
      },
    }),
    prisma.listing.create({
      data: {
        title: "Luxury Beachfront Villa",
        description: "An elegant villa steps from the beach with a private pool.",
        type: "VILLA",
        location: "Miami, USA",
        pricePerNight: 550,
        guests: 10,
        amenities: ["WiFi", "Private Pool", "Hot Tub", "Air Conditioning", "Chef's Kitchen"],
        rating: 4.9,
        hostId: host2.id,
        photos: {
          create: [
            {
              url: "https://res.cloudinary.com/demo/image/upload/villa_main.jpg",
              publicId: "listings/villa_main",
            },
            {
              url: "https://res.cloudinary.com/demo/image/upload/villa_pool.jpg",
              publicId: "listings/villa_pool",
            },
          ],
        },
      },
    }),
    prisma.listing.create({
      data: {
        title: "Rustic Mountain Cabin",
        description: "A cozy cabin nestled in the woods, ideal for a peaceful retreat.",
        type: "CABIN",
        location: "Asheville, USA",
        pricePerNight: 180,
        guests: 4,
        amenities: ["Fireplace", "WiFi", "Hot Tub", "Hiking Trail Access"],
        rating: 4.8,
        hostId: host2.id,
        photos: {
          create: [
            {
              url: "https://res.cloudinary.com/demo/image/upload/cabin_main.jpg",
              publicId: "listings/cabin_main",
            },
            {
              url: "https://res.cloudinary.com/demo/image/upload/cabin_interior.jpg",
              publicId: "listings/cabin_interior",
            },
          ],
        },
      },
    }),
  ]);

  console.log("🏠 Created 4 listings with photos (APARTMENT, HOUSE, VILLA, CABIN)");

  await Promise.all([
    prisma.booking.create({
      data: {
        guestId: guest1.id,
        listingId: apartment.id,
        checkIn: new Date("2026-06-10"),
        checkOut: new Date("2026-06-14"),
        totalPrice: 4 * apartment.pricePerNight,
        status: "CONFIRMED",
      },
    }),
    prisma.booking.create({
      data: {
        guestId: guest2.id,
        listingId: villa.id,
        checkIn: new Date("2026-07-01"),
        checkOut: new Date("2026-07-08"),
        totalPrice: 7 * villa.pricePerNight,
        status: "PENDING",
      },
    }),
    prisma.booking.create({
      data: {
        guestId: guest3.id,
        listingId: cabin.id,
        checkIn: new Date("2026-08-15"),
        checkOut: new Date("2026-08-18"),
        totalPrice: 3 * cabin.pricePerNight,
        status: "CONFIRMED",
      },
    }),
  ]);

  console.log("📅 Created 3 bookings (2 CONFIRMED, 1 PENDING)");
  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
