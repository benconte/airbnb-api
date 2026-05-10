import { PrismaClient, ListingType, Role } from "../generated/prisma/client";
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import path from 'path';
import { PrismaPg } from "@prisma/adapter-pg";

// Load .env file from the airbnb-api root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"] as string,
});
const prisma = new PrismaClient({ adapter });

const YELP_API_KEY = process.env.YELP_API_KEY;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchReviews(businessId: string) {
  const url = `https://api.yelp.com/v3/businesses/${businessId}/reviews`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${YELP_API_KEY}`
    }
  });
  if (!response.ok) {
    console.warn(`Failed to fetch reviews for ${businessId}`);
    return [];
  }
  const data = await response.json();
  return data.reviews || [];
}

async function main() {
  if (!YELP_API_KEY) {
    console.error("Missing YELP_API_KEY in environment variables.");
    process.exit(1);
  }

  console.log("Starting DB population from Yelp API...");

  const hashedPassword = await bcrypt.hash('password123', 10);
  const uniqueSuffix = Date.now().toString();

  // Create a default host for the listings
  const host = await prisma.user.create({
    data: {
      name: "Yelp Host",
      email: `yelp.host.${uniqueSuffix}@example.com`,
      username: `yelphost_${uniqueSuffix}`,
      phone: "1234567890",
      password: hashedPassword,
      role: Role.HOST,
      bio: "Automated host from Yelp Seed"
    }
  });

  let totalFetched = 0;
  const target = 100;

  // Yelp API limit is 50 per request, so we need multiple requests
  const offsets = [0, 50, 100];

  for (const offset of offsets) {
    if (totalFetched >= target) break;

    const url = `https://api.yelp.com/v3/businesses/search?term=hotel&categories=hotels&location=New+York&limit=50&offset=${offset}`;

    console.log(`Fetching hotels (offset ${offset})...`);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${YELP_API_KEY}` } });

    if (!response.ok) {
      console.error(`Failed to fetch hotels: ${response.statusText}`);
      const errorText = await response.text();
      console.error("Yelp API response:", errorText);
      continue;
    }

    const data = await response.json();
    const businesses = data.businesses || [];

    for (const business of businesses) {
      if (totalFetched >= target) break;

      const title = business.name;
      const locationStr = `${business.location.city}, ${business.location.state}`;
      const description = `Beautiful hotel located in ${locationStr}. Rating: ${business.rating} stars.`;
      const pricePerNight = business.price ? business.price.length * 100 : 150;

      const listing = await prisma.listing.create({
        data: {
          title,
          description,
          location: locationStr,
          pricePerNight,
          guests: Math.floor(Math.random() * 4) + 2, // Random guests between 2 and 5
          type: ListingType.APARTMENT,
          amenities: ["WiFi", "TV", "Air Conditioning", "Pool"],
          rating: business.rating,
          hostId: host.id,
          photos: {
            create: {
              url: business.image_url || "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg",
              publicId: `yelp_${business.id}_photo`
            }
          }
        }
      });

      // Fetch reviews
      await delay(250); // Respect Yelp API rate limits
      const reviews = await fetchReviews(business.id);

      for (const review of reviews) {
        const reviewerName = review.user?.name || "Yelp Guest";
        const randomString = Math.random().toString(36).substring(7);

        // Create a unique guest for each review so the names look somewhat real
        const guest = await prisma.user.create({
          data: {
            name: reviewerName,
            email: `guest_${Date.now()}_${randomString}@example.com`,
            username: `guest_${Date.now()}_${randomString}`,
            phone: "0000000000",
            password: hashedPassword,
            role: Role.GUEST,
            avatar: review.user?.image_url || null
          }
        });

        await prisma.review.create({
          data: {
            rating: review.rating,
            comment: review.text,
            userId: guest.id,
            listingId: listing.id
          }
        });
      }

      totalFetched++;
      console.log(`Added listing ${totalFetched}/${target}: ${title}`);
    }
  }

  console.log("Database population completed successfully.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
