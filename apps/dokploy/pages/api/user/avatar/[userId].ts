import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@dokploy/server/db";
import { userAvatar, users_temp } from "@dokploy/server/db/schema";
import { eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query;
  if (typeof userId !== "string" || !userId) {
    res.status(400).json({ error: "invalid_user_id" });
    return;
  }

  try {
    const user = await db.query.users_temp.findFirst({ where: eq(users_temp.id, userId) });
    if (!user) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (user.avatarType === "uploaded") {
      const avatar = await db.query.userAvatar.findFirst({ where: eq(userAvatar.userId, userId) });
      if (!avatar) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const buf = Buffer.from(avatar.data, "base64");
      res.setHeader("Content-Type", avatar.contentType || "application/octet-stream");
      res.setHeader("Content-Length", String(buf.length));
      // Cache for a long time; versioned via `?v=` query param in URL
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      if (avatar.updatedAt) {
        res.setHeader("Last-Modified", new Date(avatar.updatedAt).toUTCString());
      }
      res.status(200).end(buf);
      return;
    }

    // Predefined: redirect to user's image URL if available
    const target = user.image || user.avatarPredefinedId || "/avatars/avatar-1.png";
    // If relative, keep it relative; if absolute, redirect directly
    res.redirect(target);
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
}
