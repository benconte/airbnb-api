import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import prisma from "./prisma";

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationChannel =
  | "bookings"
  | "messages"
  | "reminders"
  | "promotions";

export interface NotificationPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: NotificationChannel;
  priority?: "high" | "normal";
  badge?: number;
}

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Send push notifications via the Expo push service.
 * Automatically filters invalid tokens, batches messages, and removes dead tokens.
 */
export async function sendPushNotifications(
  payload: NotificationPayload
): Promise<void> {
  const { tokens, title, body, data, channelId = "bookings", priority = "high", badge } = payload;

  // Filter out tokens that are clearly invalid
  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));

  if (validTokens.length === 0) {
    console.warn("[Notifications] No valid Expo push tokens — skipping send.");
    return;
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title,
    body,
    data: { ...(data ?? {}), channelId },
    sound: "default",
    priority,
    channelId,
    ...(badge !== undefined && { badge }),
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...chunkTickets);
    } catch (err) {
      console.error("[Notifications] Failed to send chunk:", err);
    }
  }

  // Handle error receipts — remove dead tokens
  await handleTickets(tickets, validTokens);
}

async function handleTickets(
  tickets: ExpoPushTicket[],
  tokens: string[]
): Promise<void> {
  const deadTokens: string[] = [];

  tickets.forEach((ticket, idx) => {
    if (ticket.status === "error") {
      console.error(`[Notifications] Ticket error for token ${tokens[idx]}:`, ticket.message);

      if (
        (ticket as any).details?.error === "DeviceNotRegistered"
      ) {
        deadTokens.push(tokens[idx]);
      }
    }
  });

  if (deadTokens.length > 0) {
    console.log(`[Notifications] Removing ${deadTokens.length} dead token(s).`);
    await prisma.pushToken
      .deleteMany({ where: { token: { in: deadTokens } } })
      .catch((err) =>
        console.error("[Notifications] Failed to remove dead tokens:", err)
      );
  }
}

// ─── Helpers — look up tokens for a user ─────────────────────────────────────

export async function getTokensForUser(userId: string): Promise<string[]> {
  const records = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true },
  });
  return records.map((r) => r.token);
}

// ─── Typed notification senders ───────────────────────────────────────────────

/** Guest: booking created — pending host approval */
export async function notifyGuestBookingCreated(params: {
  guestId: string;
  bookingId: string;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
}): Promise<void> {
  const tokens = await getTokensForUser(params.guestId);
  if (!tokens.length) return;

  await sendPushNotifications({
    tokens,
    title: "Booking Request Sent 📨",
    body: `Your request for ${params.listingTitle} (${params.checkIn} – ${params.checkOut}) is pending host approval.`,
    data: { screen: "BookingDetail", bookingId: params.bookingId },
    channelId: "bookings",
    priority: "high",
  });
}

/** Host: new booking request from a guest */
export async function notifyHostNewBooking(params: {
  hostId: string;
  bookingId: string;
  guestName: string;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
}): Promise<void> {
  const tokens = await getTokensForUser(params.hostId);
  if (!tokens.length) return;

  await sendPushNotifications({
    tokens,
    title: "New Booking Request 🏠",
    body: `${params.guestName} wants to book ${params.listingTitle} for ${params.checkIn} – ${params.checkOut}.`,
    data: { screen: "HostBookingDetail", bookingId: params.bookingId },
    channelId: "bookings",
    priority: "high",
  });
}

/** Guest: booking confirmed by host */
export async function notifyGuestBookingConfirmed(params: {
  guestId: string;
  bookingId: string;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
}): Promise<void> {
  const tokens = await getTokensForUser(params.guestId);
  if (!tokens.length) return;

  await sendPushNotifications({
    tokens,
    title: "Booking Confirmed ✓",
    body: `Your stay at ${params.listingTitle} is confirmed for ${params.checkIn} – ${params.checkOut}.`,
    data: { screen: "BookingDetail", bookingId: params.bookingId },
    channelId: "bookings",
    priority: "high",
  });
}

/** Guest: booking cancelled */
export async function notifyGuestBookingCancelled(params: {
  guestId: string;
  bookingId: string;
  listingTitle: string;
}): Promise<void> {
  const tokens = await getTokensForUser(params.guestId);
  if (!tokens.length) return;
  console.log("Tokens:", JSON.stringify(tokens));
  console.log("Booking cancelled", params.bookingId);

  await sendPushNotifications({
    tokens,
    title: "Booking Cancelled",
    body: `Your booking at ${params.listingTitle} has been cancelled.`,
    data: { screen: "BookingDetail", bookingId: params.bookingId },
    channelId: "bookings",
    priority: "high",
  });
}

/** Host: guest cancelled a booking */
export async function notifyHostBookingCancelled(params: {
  hostId: string;
  bookingId: string;
  guestName: string;
  listingTitle: string;
}): Promise<void> {
  const tokens = await getTokensForUser(params.hostId);
  if (!tokens.length) return;

  await sendPushNotifications({
    tokens,
    title: "Booking Cancelled",
    body: `${params.guestName} cancelled their booking at ${params.listingTitle}.`,
    data: { screen: "HostBookingDetail", bookingId: params.bookingId },
    channelId: "bookings",
    priority: "normal",
  });
}

/** Host: listing approved by admin */
export async function notifyHostListingApproved(params: {
  hostId: string;
  listingId: string;
  listingTitle: string;
}): Promise<void> {
  const tokens = await getTokensForUser(params.hostId);
  if (!tokens.length) return;

  await sendPushNotifications({
    tokens,
    title: "Listing Approved ✓",
    body: `${params.listingTitle} is now live and accepting bookings.`,
    data: { screen: "ListingDetail", listingId: params.listingId },
    channelId: "bookings",
    priority: "normal",
  });
}

/** Host: listing rejected by admin */
export async function notifyHostListingRejected(params: {
  hostId: string;
  listingId: string;
  listingTitle: string;
}): Promise<void> {
  const tokens = await getTokensForUser(params.hostId);
  if (!tokens.length) return;

  await sendPushNotifications({
    tokens,
    title: "Listing Needs Changes",
    body: `${params.listingTitle} was not approved. Tap to see feedback.`,
    data: { screen: "ListingDetail", listingId: params.listingId },
    channelId: "bookings",
    priority: "normal",
  });
}
