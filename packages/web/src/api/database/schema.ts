import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const series = sqliteTable("series", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());
export const artworks = sqliteTable("artworks", {
  id: id(),
  title: text("title").notNull(),
  series: text("series").notNull(),
  technique: text("technique").notNull().default(""),
  year: integer("year").notNull().default(2025),
  dimensions: text("dimensions").notNull().default(""),
  framing: text("framing").notNull().default(""),
  price: real("price").notNull().default(0),
  status: text("status").notNull().default("available"),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url").notNull(),
  isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});
export const requests = sqliteTable("requests", {
  id: id(),
  clientName: text("client_name").notNull(),
  clientContact: text("client_contact").notNull(),
  artworkId: text("artwork_id").references(() => artworks.id, { onDelete: "set null" }),
  artworkTitle: text("artwork_title").notNull().default(""),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("new"),
  createdAt: createdAt(),
});
export const content = sqliteTable("content", {
  id: id(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  link: text("link").notNull().default(""),
  embedUrl: text("embed_url").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  location: text("location").notNull().default(""),
  eventDate: text("event_date").notNull().default(""),
  createdAt: createdAt(),
});
export const subscribers = sqliteTable("subscribers", {
  id: id(),
  email: text("email").notNull().unique(),
  createdAt: createdAt(),
});
export const pageViews = sqliteTable("page_views", {
  id: id(),
  route: text("route").notNull(),
  artworkId: text("artwork_id"),
  viewedAt: text("viewed_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
export const adminSettings = sqliteTable("admin_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
export const rooms = sqliteTable("rooms", {
  id: id(),
  imageUrl: text("image_url").notNull(),
  createdAt: createdAt(),
});
