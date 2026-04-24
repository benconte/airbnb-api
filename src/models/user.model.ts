export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  phone: string;
  role: "host" | "guest";
  avatar?: string;
  bio?: string;
}

export const users: User[] = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice@example.com",
    username: "alicejohnson",
    phone: "+1-555-0101",
    role: "host",
    avatar: "https://i.pravatar.cc/150?u=alice",
    bio: "Experienced host with properties across the Pacific Northwest.",
  },
  {
    id: 2,
    name: "Bob Martinez",
    email: "bob@example.com",
    username: "bobmartin",
    phone: "+1-555-0102",
    role: "guest",
    avatar: "https://i.pravatar.cc/150?u=bob",
  },
  {
    id: 3,
    name: "Clara Kim",
    email: "clara@example.com",
    username: "clarakim",
    phone: "+1-555-0103",
    role: "host",
    bio: "I love sharing my cozy mountain cabin with travelers.",
  },
];
