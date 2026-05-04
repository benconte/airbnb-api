import type { Request, Response } from "express";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  JsonOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import llm from "../../config/ai.js";
import prisma from "../../config/prisma.js";

/**
 * Prompt that extracts listing-search filters from a user query.
 * If the query is unrelated to property/listing search, the AI returns
 * { "irrelevant": true } so we can skip the DB query entirely.
 */
const searchPrompt = ChatPromptTemplate.fromTemplate(`
You are a search assistant for an Airbnb-like platform.
Your job is to extract search filters from the user's natural language query.

User query: {query}

First, decide if the query is about searching for a property, listing, accommodation, or rental.
- If YES, return a JSON object with these optional fields:
  - location: string (city or area mentioned)
  - type: one of APARTMENT, HOUSE, VILLA, CABIN (if mentioned)
  - guests: number (max guests needed)
  - maxPrice: number (maximum price per night in USD)

- If NO (e.g. greetings, off-topic questions, random text), return ONLY:
  {{"irrelevant": true}}

Return ONLY valid JSON. No explanation. No markdown.
Example for a valid search: {{"location": "Miami", "type": "VILLA", "guests": 4, "maxPrice": 300}}
Example for irrelevant query: {{"irrelevant": true}}

If a search field is not mentioned, omit it from the JSON.
`);

const parser = new JsonOutputParser();

const searchChain = searchPrompt.pipe(llm).pipe(parser);

export async function naturalLanguageSearch(
  req: Request,
  res: Response
): Promise<void> {
  const { query } = req.body;

  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  // Extract filters (or detect irrelevance) via AI
  const filters = (await searchChain.invoke({ query })) as {
    irrelevant?: boolean;
    location?: string;
    type?: string;
    guests?: number;
    maxPrice?: number;
  };

  // If the query isn't about listings, return a conversational response
  if (filters.irrelevant) {
    res.status(200).json({
      query,
      message:
        "I can only help you search for listings. Try something like: 'Find a villa in Paris for 4 guests under $200/night'.",
      results: [],
      count: 0,
    });
    return;
  }

  // If no filters were extracted at all, the query is too vague
  const hasFilters =
    filters.location || filters.type || filters.guests || filters.maxPrice;

  if (!hasFilters) {
    res.status(200).json({
      query,
      message:
        "Your query didn't contain enough details to search for listings. Try specifying a location, property type, number of guests, or budget.",
      results: [],
      count: 0,
    });
    return;
  }

  // Build Prisma where clause from extracted filters
  const where: Record<string, unknown> = {};

  if (filters.location) {
    where["location"] = { contains: filters.location, mode: "insensitive" };
  }
  if (filters.type) {
    where["type"] = filters.type;
  }
  if (filters.guests) {
    where["guests"] = { gte: filters.guests };
  }
  if (filters.maxPrice) {
    where["pricePerNight"] = { lte: filters.maxPrice };
  }

  const listings = await prisma.listing.findMany({
    where,
    include: {
      host: { select: { name: true, avatar: true } },
    },
    take: 10,
  });

  // No matching listings found — do NOT fall back to unrelated results
  if (listings.length === 0) {
    res.status(200).json({
      query,
      extractedFilters: filters,
      message:
        "No listings found matching your search criteria. Try adjusting your filters (location, type, guests, or price).",
      results: [],
      count: 0,
    });
    return;
  }

  res.json({
    query,
    extractedFilters: filters,
    results: listings,
    count: listings.length,
  });
}

// ─── Listing Description Generator ───────────────────────────────────────────

const descriptionPrompt = ChatPromptTemplate.fromTemplate(`
You are a professional copywriter for an Airbnb-like platform.
Write an engaging, warm, and descriptive listing description.

Listing details:
- Title: {title}
- Location: {location}
- Type: {type}
- Max guests: {guests}
- Amenities: {amenities}
- Price per night: \${price} USD

Write a 3-paragraph description:
1. Opening hook — what makes this place special
2. The space — describe the property and its features
3. The location — what guests can do nearby

Keep it between 150-200 words. Be specific and inviting. Do not use generic phrases like "perfect getaway".
`);

const descriptionChain = descriptionPrompt
  .pipe(llm)
  .pipe(new StringOutputParser());

export async function generateListingDescription(
  req: Request,
  res: Response
): Promise<void> {
  const { title, location, type, guests, amenities, price } = req.body;

  if (!title || !location || !type || !guests || !amenities || !price) {
    res.status(400).json({
      error: "title, location, type, guests, amenities, and price are required",
    });
    return;
  }

  const description = await descriptionChain.invoke({
    title,
    location,
    type,
    guests,
    amenities: Array.isArray(amenities) ? amenities.join(", ") : amenities,
    price,
  });

  res.json({ description });
}

// ─── Chatbot ──────────────────────────────────────────────────────────────────

// Store conversation histories in memory.
// In production, store these in Redis or a database.
const sessionHistories = new Map<string, InMemoryChatMessageHistory>();

function getSessionHistory(sessionId: string): InMemoryChatMessageHistory {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, new InMemoryChatMessageHistory());
  }
  return sessionHistories.get(sessionId)!;
}

/**
 * Lightweight heuristic to decide if a user message is listing-related.
 * This avoids querying the DB and inflating listing context for greetings
 * or unrelated questions (e.g. "hi", "how are you", "what's 2+2").
 */
function isListingRelated(message: string): boolean {
  const keywords = [
    "listing",
    "listings",
    "property",
    "properties",
    "apartment",
    "house",
    "villa",
    "cabin",
    "room",
    "rent",
    "rental",
    "book",
    "booking",
    "stay",
    "night",
    "price",
    "guest",
    "available",
    "availability",
    "amenities",
    "location",
    "find",
    "search",
    "show me",
    "do you have",
  ];
  const lower = message.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

const chatPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a helpful Airbnb assistant. You help guests find listings, answer questions about properties, and assist with bookings.
You can also respond normally to greetings and general questions — you don't have to talk only about listings.

{listingsContext}

Be friendly, concise, and helpful. If you don't know something, say so.
If asked about specific listings, refer to the context provided.
If asked about listings that are not in the context or don't exist, clearly state that those listings are not available — do NOT make up or suggest unrelated listings.`,
  ],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
]);

const chatChain = chatPrompt.pipe(llm);

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: chatChain,
  getMessageHistory: getSessionHistory,
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
});

export async function chat(req: Request, res: Response): Promise<void> {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    res.status(400).json({ error: "message and sessionId are required" });
    return;
  }

  let listingsContext = "No listing context provided.";

  // Only fetch listings from the DB if the message is likely listing-related
  if (isListingRelated(message)) {
    const listings = await prisma.listing.findMany({
      take: 5,
      select: {
        title: true,
        location: true,
        pricePerNight: true,
        type: true,
        guests: true,
        amenities: true,
      },
    });

    if (listings.length > 0) {
      listingsContext =
        "Available listings:\n" +
        listings
          .map(
            (l) =>
              `- ${l.title} in ${l.location}: $${l.pricePerNight}/night, ${l.type}, up to ${l.guests} guests, amenities: ${l.amenities.join(", ")}`
          )
          .join("\n");
    } else {
      listingsContext =
        "There are currently no listings available in the database.";
    }
  }

  const reply = await chainWithHistory.invoke(
    { input: message, listingsContext },
    { configurable: { sessionId } }
  );

  res.json({ reply, sessionId });
}
