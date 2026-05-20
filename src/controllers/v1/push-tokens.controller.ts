import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import prisma from "../../config/prisma";

/**
 * POST /api/v1/users/push-token
 * Register or update an Expo push token for the authenticated user.
 */
export const registerPushToken = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const { token, platform, deviceName } = req.body as {
      token?: string;
      platform?: string;
      deviceName?: string;
    };

    if (!token || !platform) {
      res.status(400).json({ message: "Missing required fields: token, platform." });
      return;
    }

    if (!["ios", "android"].includes(platform)) {
      res.status(400).json({ message: "platform must be 'ios' or 'android'." });
      return;
    }

    // Upsert so the same token can't be duplicated, and update deviceName if changed
    const pushToken = await prisma.pushToken.upsert({
      where: { token },
      create: { token, platform, deviceName, userId },
      update: { platform, deviceName, userId },
    });

    res.status(201).json({ message: "Push token registered.", id: pushToken.id });
  } catch (err) {
    console.error("[registerPushToken] Error:", err);
    res.status(500).json({ message: "Something went wrong." });
  }
};

/**
 * PUT /api/v1/users/push-token
 * Replace an old token with a new one (token refresh scenario).
 */
export const refreshPushToken = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const { oldToken, newToken, platform, deviceName } = req.body as {
      oldToken?: string;
      newToken?: string;
      platform?: string;
      deviceName?: string;
    };

    if (!oldToken || !newToken || !platform) {
      res.status(400).json({ message: "Missing required fields: oldToken, newToken, platform." });
      return;
    }

    // Delete the old token and insert the new one atomically
    await prisma.$transaction([
      prisma.pushToken.deleteMany({ where: { token: oldToken, userId } }),
      prisma.pushToken.upsert({
        where: { token: newToken },
        create: { token: newToken, platform, deviceName, userId },
        update: { platform, deviceName, userId },
      }),
    ]);

    res.json({ message: "Push token refreshed." });
  } catch (err) {
    console.error("[refreshPushToken] Error:", err);
    res.status(500).json({ message: "Something went wrong." });
  }
};

/**
 * DELETE /api/v1/users/push-token
 * Remove a push token (logout scenario).
 */
export const deletePushToken = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const { token } = req.body as { token?: string };

    if (!token) {
      res.status(400).json({ message: "Missing required field: token." });
      return;
    }

    await prisma.pushToken.deleteMany({ where: { token, userId } });

    res.json({ message: "Push token removed." });
  } catch (err) {
    console.error("[deletePushToken] Error:", err);
    res.status(500).json({ message: "Something went wrong." });
  }
};

/**
 * GET /api/v1/users/push-token
 * List push tokens for the authenticated user (useful for debugging / profile settings).
 */
export const listPushTokens = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const tokens = await prisma.pushToken.findMany({
      where: { userId },
      select: { id: true, platform: true, deviceName: true, createdAt: true },
    });

    res.json({ data: tokens });
  } catch (err) {
    console.error("[listPushTokens] Error:", err);
    res.status(500).json({ message: "Something went wrong." });
  }
};
