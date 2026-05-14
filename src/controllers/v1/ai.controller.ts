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

// Track the last search filters per session so follow-up messages inherit context
const sessionLastFilters = new Map<
  string,
  { location?: string; type?: string; guests?: number; maxPrice?: number }
>();

function getSessionHistory(sessionId: string): InMemoryChatMessageHistory {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, new InMemoryChatMessageHistory());
  }
  return sessionHistories.get(sessionId)!;
}

/**
 * Prompt that extracts search filters from a user message WITH conversation context.
 * Handles follow-ups like "how about miami" or "can you recommend some".
 */
const contextualSearchPrompt = ChatPromptTemplate.fromTemplate(`
You are a search filter extractor for an Airbnb-like property rental platform.

Recent conversation context (last few exchanges):
{conversationContext}

Current user message: {message}

Your task: Extract property search filters from the CURRENT message, using the conversation context to fill in missing info for follow-up questions.

Examples of follow-ups that need context:
- "how about miami" → inherit previous type/guests/price, change location to Miami
- "can you recommend some" → keep all previous filters
- "show me cheaper options" → lower the maxPrice from previous search
- "what about villas?" → inherit previous location/guests, change type to VILLA

Rules:
1. If the message is a property search or follow-up, return a JSON with these optional fields:
   - location: string (city or area)
   - type: one of APARTMENT, HOUSE, VILLA, CABIN
   - guests: number
   - maxPrice: number (USD per night)
   - isListingQuery: true

2. If the message is completely unrelated to properties/bookings (e.g. "what's the weather?", "tell me a joke"), return:
   {{"isListingQuery": false}}

3. If the message is about booking help, disputes, or platform navigation (not searching for listings), return:
   {{"isListingQuery": false}}

Return ONLY valid JSON. No explanation. No markdown.
`);

const contextualSearchChain = contextualSearchPrompt.pipe(llm).pipe(parser);

const HELPDESK_SYSTEM_PROMPT = `You are StayBot, a friendly and knowledgeable help-desk assistant for StayHub — an Airbnb-like property rental platform.

Your role is to help users with:
1. **Finding listings** — help guests search for properties by location, type, guests, or price
2. **Booking help** — explain how bookings work, booking statuses (PENDING → host approval → CONFIRMED or CANCELLED)
3. **Disputes** — explain what disputes are, how to file one, and what happens after
4. **Platform navigation** — guide users to the right pages and features
5. **General support** — answer questions about the platform with warmth and clarity

## Key Platform Knowledge:

### Bookings:
- Guests browse listings and submit a booking request with check-in/check-out dates
- Bookings start as **PENDING** — the host must approve or decline
- Once approved, the booking becomes **CONFIRMED**
- Hosts can also **CANCEL** bookings. Guests receive email notifications on status changes
- Guests can view their bookings on the **Trips** page (/trips)

### Disputes:
- A dispute can be filed when there's a problem with a booking (e.g. property not as described, refund issues, host misconduct)
- **How to file a dispute**: Go to your booking on the Trips page, and use the "File Dispute" option
- **Required information**: Title, description, reason (e.g. PROPERTY_CONDITION, REFUND_ISSUE, HOST_MISCONDUCT, GUEST_MISCONDUCT, CANCELLATION, OTHER), and the booking ID
- **After filing**: The dispute is reviewed by our admin team with status: OPEN → UNDER_REVIEW → RESOLVED or CLOSED
- **Resolution**: Admins may provide a resolution note and update the dispute status accordingly
- Only guests who made the booking can file a dispute for that booking

### Listing Types:
- APARTMENT, HOUSE, VILLA, CABIN

### User Roles:
- **Guest**: Browse and book listings, manage trips, file disputes
- **Host**: List properties, manage bookings (approve/decline), view analytics
- **Admin**: Manage all users, listings, bookings, disputes

### Quick Navigation:
- Browse listings: /listings
- My trips/bookings: /trips
- My wishlists: /wishlists  
- Host dashboard: /dashboard
- Admin portal: /admin
- Profile settings: /profile

{listingsContext}

## Behavior Guidelines:
- **Always greet users warmly** and ask what they're looking for if it's the start of a conversation
- **Offer helpful suggestions** proactively — e.g., mention you can help find listings, explain bookings, or handle disputes
- **Be concise but thorough** — give clear answers without overwhelming users
- **Use emojis sparingly** to keep the tone friendly (1-2 per message max)
- **Never make up listings** — only reference actual listings from the context provided
- **For greetings**: Respond warmly, introduce yourself, and offer 3-4 quick things you can help with
- If you don't know something, say so honestly and suggest the user contact support`;

const chatPrompt = ChatPromptTemplate.fromMessages([
  ["system", HELPDESK_SYSTEM_PROMPT],
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

  let listingsContext = "No specific listing context loaded for this message.";
  let shownListings: {
    id: string;
    title: string;
    location: string;
    pricePerNight: number;
    type: string;
    guests: number;
    rating: number | null;
    photo: string | null;
  }[] = [];

  // Build a short conversation context string for the filter extractor
  const history = getSessionHistory(sessionId);
  const recentMessages = await history.getMessages();
  const conversationContext =
    recentMessages.length === 0
      ? "No prior conversation."
      : recentMessages
        .slice(-6) // last 3 exchanges
        .map((m) => `${m.type === "human" ? "User" : "Assistant"}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
        .join("\n");

  // Use LLM to extract filters (context-aware — handles follow-ups)
  let extractedFilters: {
    isListingQuery?: boolean;
    location?: string;
    type?: string;
    guests?: number;
    maxPrice?: number;
  } = {};

  try {
    extractedFilters = (await contextualSearchChain.invoke({
      message,
      conversationContext,
    })) as typeof extractedFilters;
  } catch {
    // If filter extraction fails, treat as non-listing query
    extractedFilters = { isListingQuery: false };
  }

  if (extractedFilters.isListingQuery !== false) {
    // Merge with session's last known filters for follow-up continuity
    const lastFilters = sessionLastFilters.get(sessionId) ?? {};
    const mergedFilters = {
      location: extractedFilters.location ?? lastFilters.location,
      type: extractedFilters.type ?? lastFilters.type,
      guests: extractedFilters.guests ?? lastFilters.guests,
      maxPrice: extractedFilters.maxPrice ?? lastFilters.maxPrice,
    };

    // Persist updated filters for next follow-up
    const updatedFilters = {
      ...(mergedFilters.location && { location: mergedFilters.location }),
      ...(mergedFilters.type && { type: mergedFilters.type }),
      ...(mergedFilters.guests && { guests: mergedFilters.guests }),
      ...(mergedFilters.maxPrice && { maxPrice: mergedFilters.maxPrice }),
    };
    if (Object.keys(updatedFilters).length > 0) {
      sessionLastFilters.set(sessionId, updatedFilters);
    }

    // Build Prisma where clause
    const where: Record<string, unknown> = {};
    if (mergedFilters.location) {
      where["location"] = { contains: mergedFilters.location, mode: "insensitive" };
    }
    if (mergedFilters.type) {
      where["type"] = mergedFilters.type;
    }
    if (mergedFilters.guests) {
      where["guests"] = { gte: mergedFilters.guests };
    }
    if (mergedFilters.maxPrice) {
      where["pricePerNight"] = { lte: mergedFilters.maxPrice };
    }

    const listings = await prisma.listing.findMany({
      where,
      take: 6,
      select: {
        id: true,
        title: true,
        location: true,
        pricePerNight: true,
        type: true,
        guests: true,
        amenities: true,
        rating: true,
        photos: { select: { url: true }, take: 1 },
      },
      orderBy: [{ rating: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    });

    if (listings.length > 0) {
      shownListings = listings.map((l) => ({
        id: l.id,
        title: l.title,
        location: l.location,
        pricePerNight: l.pricePerNight,
        type: l.type,
        guests: l.guests,
        rating: l.rating,
        photo: l.photos[0]?.url ?? null,
      }));

      listingsContext =
        "### Available Listings matching the user's search (shown as clickable cards to the user):\n" +
        listings
          .map(
            (l) =>
              `- **${l.title}** in ${l.location}: $${l.pricePerNight}/night, ${l.type}, up to ${l.guests} guests${l.rating ? `, ⭐ ${l.rating}` : ""}, amenities: ${l.amenities.slice(0, 5).join(", ")}${l.amenities.length > 5 ? " and more" : ""}`
          )
          .join("\n") +
        "\n\nIMPORTANT: The user will see clickable listing cards below your message — you do NOT need to provide links or URLs yourself. Just reference the listing names naturally in your reply.";
    } else {
      listingsContext =
        mergedFilters.location
          ? `No listings found in ${mergedFilters.location} matching the current filters. Let the user know and suggest broadening their search.`
          : "There are currently no listings available matching those filters.";
    }
  }

  const reply = await chainWithHistory.invoke(
    { input: message, listingsContext },
    { configurable: { sessionId } }
  );

  res.json({ reply, sessionId, listings: shownListings });
}
