import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users_temp } from "./user";

export const userAvatar = pgTable("user_avatar", {
  userId: text("userId")
    .notNull()
    .primaryKey()
    .references(() => users_temp.id, { onDelete: "cascade" }),
  contentType: text("contentType").notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  // Store base64-encoded image data for now; can be migrated to object storage later
  data: text("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
