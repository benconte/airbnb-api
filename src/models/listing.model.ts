export interface Listing {
  id: number;
  title: string;
  description: string;
  location: string;
  pricePerNight: number;
  guests: number;
  type: "apartment" | "house" | "villa" | "cabin";
  amenities: string[];
  host: string;
  rating?: number;
}

export const listings: Listing[] = [
  {
    id: 1,
    title: "Cozy Downtown Apartment",
    description:
      "A stylish one-bedroom apartment in the heart of the city, walking distance to restaurants and cafés.",
    location: "Seattle, WA",
    pricePerNight: 120,
    guests: 2,
    type: "apartment",
    amenities: ["WiFi", "Kitchen", "Air conditioning", "Washer"],
    host: "alicejohnson",
    rating: 4.8,
  },
  {
    id: 2,
    title: "Rustic Mountain Cabin",
    description:
      "A peaceful retreat nestled in the Cascades with stunning views, perfect for hiking lovers.",
    location: "Leavenworth, WA",
    pricePerNight: 180,
    guests: 6,
    type: "cabin",
    amenities: ["Fireplace", "Hot tub", "WiFi", "BBQ grill", "Parking"],
    host: "clarakim",
    rating: 4.9,
  },
  {
    id: 3,
    title: "Beachfront Villa",
    description:
      "Luxurious villa with private beach access and panoramic ocean views. Ideal for family getaways.",
    location: "Malibu, CA",
    pricePerNight: 550,
    guests: 10,
    type: "villa",
    amenities: [
      "Pool",
      "WiFi",
      "Kitchen",
      "Private beach",
      "Gym",
      "Air conditioning",
    ],
    host: "alicejohnson",
    rating: 5.0,
  },
];
