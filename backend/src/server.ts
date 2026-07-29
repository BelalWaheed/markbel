import express, { Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import webpush from "web-push";
import { connectToDatabase } from "./db.js";
import User from "./models/User.js";
import Bookmark from "./models/Bookmark.js";
import PushSubscription from "./models/PushSubscription.js";
import {
  getTickTickAuthUrl,
  exchangeCodeForTokens,
  refreshTickTickToken,
  listTickTickProjects,
  getOrCreateMarkbelProject,
  createTickTickTask,
  getTickTickTask,
} from "./ticktick.js";
import { authMiddleware, AuthRequest } from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_local_dev";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@markbel.app";
const CRON_SECRET = process.env.CRON_SECRET || "fallback_cron_secret";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.warn("[VAPID Setup Warning]:", err);
  }
}

app.use(cors());
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE MIDDLEWARE (Ensure connected before any queries)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err: any) {
    console.error("[DB connection failed]:", err);
    res
      .status(500)
      .json({ error: "Database connection failed: " + err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER AUTH ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/users/signup
app.post("/api/users/signup", authLimiter, async (req, res) => {
  try {
    const { name, email, password, avatar } = req.body;
    if (!email || !name || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      res
        .status(409)
        .json({ error: "An account with this email already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const payload = {
      name,
      email,
      avatar: avatar || "",
      id: crypto.randomUUID(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    const user = new User(payload);
    await user.save();

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    const userObj = user.toJSON();

    res.status(201).json({ token, user: userObj });
  } catch (err: any) {
    console.error("[API Signup] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// POST /api/users/login
app.post("/api/users/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: "No account found with this email" });
      return;
    }

    if (!user.password) {
      res.status(401).json({ error: "User account has no password set" });
      return;
    }

    let isValid = false;
    if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
      isValid = bcrypt.compareSync(password, user.password);
    } else {
      console.warn(
        `[Security Warning] User ${user.email} logged in using legacy plaintext password. Upgrading to hash now...`
      );
      isValid = user.password === password;
      if (isValid) {
        user.password = bcrypt.hashSync(password, SALT_ROUNDS);
        await user.save();
      }
    }

    if (!isValid) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    const userObj = user.toJSON();

    res.json({ token, user: userObj });
  } catch (err: any) {
    console.error("[API Login] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// GET /api/users/me (Get profile)
app.get("/api/users/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findOne({ id: req.userId }).lean();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { password, _id, __v, ...safeUser } = user as any;
    res.json(safeUser);
  } catch (err: any) {
    console.error("[API User Me] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKMARKS CRUD ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SSEClient {
  userId: string;
  res: Response;
}
let sseClients: SSEClient[] = [];

// Helper to notify clients
function notifyClients(userId: string, type: string, data?: any) {
  const payload = JSON.stringify({ type, data });
  sseClients.forEach((client) => {
    if (client.userId === userId) {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch (err) {
        console.warn("[SSE] Failed to write to client:", err);
      }
    }
  });
}

// GET /api/bookmarks/events (SSE Stream)
app.get("/api/bookmarks/events", (req, res) => {
  const token = req.query.token as string;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const userId = decoded.id;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send initial ping to keep connection alive
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    const client = { userId, res };
    sseClients.push(client);

    req.on("close", () => {
      sseClients = sseClients.filter((c) => c !== client);
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// GET /api/bookmarks
app.get("/api/bookmarks", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const query: any = { userId: req.userId };
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    const bookmarks = await Bookmark.find(query).lean();
    res.json(bookmarks);
  } catch (err: any) {
    console.error("[API Bookmarks GET] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// POST /api/bookmarks
app.post("/api/bookmarks", authMiddleware, async (req: AuthRequest, res) => {
  try {
    let { title, url, description, image, group, isRead, readAt, isPinned, remindAt, isArchived, archiveGroup } = req.body;
    if (!url) {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    url = url.trim();
    let finalTitle = title ? title.trim() : "";
    let finalImage = image ? image.trim() : "";
    let finalDescription = description ? description.trim() : "";

    const shouldScrapeTitle = !finalTitle || finalTitle === url;
    const shouldScrapeImage = !finalImage;
    const shouldScrapeDesc = !finalDescription;

    // Set initial title fallback if none is provided
    let initialTitle = finalTitle;
    if (!initialTitle) {
      try {
        const parsedUrl = new URL(url);
        initialTitle = parsedUrl.hostname;
      } catch {
        initialTitle = url;
      }
    }

    const payload = {
      title: initialTitle,
      url,
      description: finalDescription,
      image: finalImage,
      group: group || "Unsorted",
      isRead: Boolean(isRead),
      readAt: readAt || "",
      isPinned: Boolean(isPinned),
      remindAt: remindAt || "",
      isArchived: Boolean(isArchived),
      archiveGroup: archiveGroup || "",
      userId: req.userId,
      id: req.body.id || crypto.randomUUID(),
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: req.body.updatedAt || new Date().toISOString(),
    };

    const bookmark = new Bookmark(payload);
    await bookmark.save();

    // Respond immediately to the client
    res.status(201).json(bookmark.toJSON());

    // Notify other clients about the creation
    notifyClients(req.userId!, "bookmark_created", bookmark.toJSON());

    // Perform scraping in the background asynchronously
    if (shouldScrapeTitle || shouldScrapeImage || shouldScrapeDesc) {
      (async () => {
        try {
          const parsedUrl = new URL(url);

          // Parse YouTube video ID
          let ytId: string | null = null;
          if (parsedUrl.hostname.includes("youtube.com")) {
            if (parsedUrl.pathname.startsWith("/watch")) {
              ytId = parsedUrl.searchParams.get("v");
            } else if (parsedUrl.pathname.startsWith("/embed/")) {
              ytId = parsedUrl.pathname.split("/")[2];
            } else if (parsedUrl.pathname.startsWith("/shorts/")) {
              ytId = parsedUrl.pathname.split("/")[2];
            }
          } else if (parsedUrl.hostname.includes("youtu.be")) {
            const parts = parsedUrl.pathname.slice(1).split("/");
            ytId = parts[0];
          }

          let scrapedTitle = "";
          let scrapedDesc = "";
          let scrapedImage = ytId
            ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
            : "";

          // Only fetch if needed and it's not a YouTube ID or we need more metadata
          if (!ytId || shouldScrapeTitle || shouldScrapeDesc) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 4000);

              let userAgent =
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36";
              if (parsedUrl.hostname.includes("instagram.com")) {
                userAgent =
                  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_codedoc.html)";
              }

              const response = await fetch(parsedUrl.toString(), {
                headers: { "User-Agent": userAgent },
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              if (response.ok) {
                const html = await response.text();

                const getMetaTag = (property: string) => {
                  const regex = new RegExp(
                    `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
                    "i",
                  );
                  const match = html.match(regex);
                  if (match) return match[1];
                  const altRegex = new RegExp(
                    `<meta[^]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
                    "i",
                  );
                  const altMatch = html.match(altRegex);
                  return altMatch ? altMatch[1] : "";
                };

                const getTitle = () => {
                  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
                  return match ? match[1] : "";
                };

                scrapedTitle =
                  getMetaTag("og:title") ||
                  getMetaTag("twitter:title") ||
                  getTitle();
                scrapedDesc =
                  getMetaTag("og:description") ||
                  getMetaTag("twitter:description") ||
                  "";

                if (!ytId) {
                  scrapedImage =
                    getMetaTag("og:image") || getMetaTag("twitter:image") || "";
                  if (scrapedImage && !scrapedImage.startsWith("http")) {
                    scrapedImage = new URL(
                      scrapedImage,
                      parsedUrl.origin,
                    ).toString();
                  }
                }
              }
            } catch (fetchErr) {
              console.warn(
                "[Server Auto-Scrape Background] Scraper fetch warning:",
                fetchErr,
              );
            }
          }

          const decodeHtml = (str: string) => {
            return str
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
          };

          let updatedTitle = payload.title;
          let updatedImage = payload.image;
          let updatedDescription = payload.description;

          if (shouldScrapeTitle && scrapedTitle) {
            updatedTitle = decodeHtml(scrapedTitle.trim());
          } else if (
            shouldScrapeTitle &&
            ytId &&
            (updatedTitle === url || updatedTitle === parsedUrl.hostname)
          ) {
            updatedTitle = "YouTube Video";
          }

          if (shouldScrapeImage && scrapedImage) {
            updatedImage = scrapedImage.trim();
          }
          if (shouldScrapeDesc && scrapedDesc) {
            updatedDescription = decodeHtml(scrapedDesc.trim());
          }

          await Bookmark.updateOne(
            { id: payload.id },
            {
              $set: {
                title: updatedTitle,
                image: updatedImage,
                description: updatedDescription,
                updatedAt: new Date().toISOString(),
              },
            },
          );
          console.log(
            `[Server Auto-Scrape Background] Successfully updated bookmark ${payload.id}`,
          );
          // Notify clients that the bookmark details have been updated!
          if (payload.userId) {
            notifyClients(payload.userId, "bookmark_updated", { id: payload.id });
          }
        } catch (backgroundErr) {
          console.error(
            "[Server Auto-Scrape Background] Error during async crawl:",
            backgroundErr,
          );
        }
      })();
    }
  } catch (err: any) {
    console.error("[API Bookmarks POST] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PUT /api/bookmarks (Uses query ?id=xxx)
app.put("/api/bookmarks", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }

    const incomingData = req.body || {};
    delete incomingData._id;

    const existingBookmark = await Bookmark.findOne({ id, userId: req.userId });
    if (!existingBookmark) {
      res.status(404).json({ error: "Bookmark not found" });
      return;
    }

    const incomingTime = new Date(
      incomingData.updatedAt || new Date().toISOString(),
    ).getTime();
    const serverTime = new Date(
      existingBookmark.updatedAt || new Date().toISOString(),
    ).getTime();
    if (incomingTime < serverTime) {
      res.status(409).json(existingBookmark.toJSON());
      return;
    }

    Object.assign(existingBookmark, incomingData);
    existingBookmark.updatedAt = new Date().toISOString();
    await existingBookmark.save();

    res.json(existingBookmark.toJSON());

    // Notify clients of modification
    notifyClients(req.userId!, "bookmark_updated", existingBookmark.toJSON());
  } catch (err: any) {
    console.error("[API Bookmarks PUT] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PUT /api/bookmarks/group (Rename a group for the current user)
app.put(
  "/api/bookmarks/group",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { oldName, newName } = req.body;
      if (!oldName || !newName) {
        res
          .status(400)
          .json({ error: "Old group name and new group name are required" });
        return;
      }

      const result = await Bookmark.updateMany(
        { userId: req.userId, group: oldName },
        { $set: { group: newName, updatedAt: new Date().toISOString() } },
      );

      res.json({ success: true, modifiedCount: result.modifiedCount });

      // Notify clients of group rename updates
      notifyClients(req.userId!, "bookmark_updated");
    } catch (err: any) {
      console.error("[API Bookmarks Group PUT] Error:", err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
    }
  },
);

// DELETE /api/bookmarks (Uses query ?id=xxx)
app.delete("/api/bookmarks", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }

    const result = await Bookmark.deleteOne({ id, userId: req.userId });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Bookmark not found or already deleted" });
      return;
    }

    res.json({ success: true });

    // Notify clients of deletion
    notifyClients(req.userId!, "bookmark_deleted", { id });
  } catch (err: any) {
    console.error("[API Bookmarks DELETE] Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKMARK LIFECYCLE & DISCOVERY ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/bookmarks/stats
app.get("/api/bookmarks/stats", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const all = await Bookmark.find({ userId: req.userId, isArchived: { $ne: true } }).lean();
    const total = all.length;
    const unread = all.filter((b) => !b.isRead).length;
    const read = total - unread;
    const pinnedCount = all.filter((b) => b.isPinned).length;
    
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const savedThisWeek = all.filter((b) => b.createdAt >= oneWeekAgo).length;

    const archivedCount = await Bookmark.countDocuments({ userId: req.userId, isArchived: true });

    res.json({ total, read, unread, savedThisWeek, pinnedCount, archivedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// GET /api/bookmarks/due
app.get("/api/bookmarks/due", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const now = new Date().toISOString();
    const dueBookmarks = await Bookmark.find({
      userId: req.userId,
      isArchived: { $ne: true },
      isRead: { $ne: true },
      remindAt: { $ne: "", $lte: now },
    }).lean();
    res.json(dueBookmarks);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// GET /api/bookmarks/random
app.get("/api/bookmarks/random", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const count = parseInt(req.query.count as string) || 3;
    const unread = await Bookmark.find({
      userId: req.userId,
      isArchived: { $ne: true },
      isRead: { $ne: true },
    }).lean();

    const shuffled = unread.sort(() => 0.5 - Math.random());
    res.json(shuffled.slice(0, count));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// GET /api/bookmarks/archived
app.get("/api/bookmarks/archived", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const archived = await Bookmark.find({ userId: req.userId, isArchived: true }).lean();
    res.json(archived);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PATCH /api/bookmarks/read?id=xxx
app.patch("/api/bookmarks/read", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }
    const bookmark = await Bookmark.findOne({ id, userId: req.userId });
    if (!bookmark) {
      res.status(404).json({ error: "Bookmark not found" });
      return;
    }
    const newIsRead = req.body.isRead !== undefined ? req.body.isRead : !bookmark.isRead;
    bookmark.isRead = newIsRead;
    bookmark.readAt = newIsRead ? new Date().toISOString() : "";
    bookmark.updatedAt = new Date().toISOString();
    await bookmark.save();

    res.json(bookmark.toJSON());
    notifyClients(req.userId!, "bookmark_updated", bookmark.toJSON());
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PATCH /api/bookmarks/pin?id=xxx
app.patch("/api/bookmarks/pin", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }
    const bookmark = await Bookmark.findOne({ id, userId: req.userId });
    if (!bookmark) {
      res.status(404).json({ error: "Bookmark not found" });
      return;
    }
    bookmark.isPinned = req.body.isPinned !== undefined ? req.body.isPinned : !bookmark.isPinned;
    bookmark.updatedAt = new Date().toISOString();
    await bookmark.save();

    res.json(bookmark.toJSON());
    notifyClients(req.userId!, "bookmark_updated", bookmark.toJSON());
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PATCH /api/bookmarks/archive?id=xxx
app.patch("/api/bookmarks/archive", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }
    const bookmark = await Bookmark.findOne({ id, userId: req.userId });
    if (!bookmark) {
      res.status(404).json({ error: "Bookmark not found" });
      return;
    }
    bookmark.isArchived = true;
    bookmark.archiveGroup = req.body.archiveGroup || bookmark.archiveGroup || "archive-general";
    bookmark.updatedAt = new Date().toISOString();
    await bookmark.save();

    res.json(bookmark.toJSON());
    notifyClients(req.userId!, "bookmark_updated", bookmark.toJSON());
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// PATCH /api/bookmarks/unarchive?id=xxx
app.patch("/api/bookmarks/unarchive", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      res.status(400).json({ error: "Bookmark ID is required" });
      return;
    }
    const bookmark = await Bookmark.findOne({ id, userId: req.userId });
    if (!bookmark) {
      res.status(404).json({ error: "Bookmark not found" });
      return;
    }
    bookmark.isArchived = false;
    bookmark.archiveGroup = "";
    bookmark.updatedAt = new Date().toISOString();
    await bookmark.save();

    res.json(bookmark.toJSON());
    notifyClients(req.userId!, "bookmark_updated", bookmark.toJSON());
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TICKTICK INTEGRATION ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/integrations/ticktick/auth
app.get("/api/integrations/ticktick/auth", authMiddleware, (req: AuthRequest, res) => {
  const url = getTickTickAuthUrl(req.userId || "");
  res.json({ url });
});

// GET /api/integrations/ticktick/callback
app.get("/api/integrations/ticktick/callback", async (req, res) => {
  try {
    const { code, state, error: tickError } = req.query;
    if (tickError) {
      res.status(400).send(`
        <html>
          <body style="background:#050508;color:#ff007f;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;text-align:center;">
            <h2>TICKTICK AUTH DENIED</h2>
            <p>${tickError}</p>
            <script>setTimeout(() => { window.location.href = '/settings?ticktick=error'; }, 3000);</script>
          </body>
        </html>
      `);
      return;
    }

    if (!code) {
      res.status(400).send("Authorization code missing");
      return;
    }

    const { access_token, refresh_token, expires_in } = await exchangeCodeForTokens(code as string);
    const expiresAt = Date.now() + expires_in * 1000;

    let user;
    if (state) {
      user = await User.findOne({ id: state as string });
    }
    if (!user && req.headers.authorization) {
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      user = await User.findOne({ id: decoded.id });
    }
    if (!user) {
      // Fallback: take the single user if only one exists
      user = await User.findOne();
    }

    if (user) {
      user.ticktickAccessToken = access_token;
      user.ticktickRefreshToken = refresh_token;
      user.ticktickTokenExpiresAt = expiresAt;

      try {
        const projId = await getOrCreateMarkbelProject(access_token);
        user.ticktickDefaultProjectId = projId;
      } catch (err) {
        console.warn("[TickTick Callback] Project creation warning:", err);
      }

      await user.save();
    }

    res.send(`
      <html>
        <body style="background:#050508;color:#00f0ff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;">
          <h2>TICKTICK CONNECTED SUCCESSFULLY</h2>
          <p>Redirecting to Markbel Settings...</p>
          <script>
            setTimeout(() => {
              window.location.href = '/settings?ticktick=connected';
            }, 1500);
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("[TickTick Callback Error]:", err);
    res.status(500).send(`
      <html>
        <body style="background:#050508;color:#ff007f;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;text-align:center;padding:20px;">
          <h2>TICKTICK AUTH FAILED</h2>
          <p>${err.message || 'Unknown OAuth error'}</p>
          <a href="/settings" style="color:#00f0ff;margin-top:15px;">Return to Settings</a>
        </body>
      </html>
    `);
  }
});

// DELETE /api/integrations/ticktick
app.delete("/api/integrations/ticktick", authMiddleware, async (req: AuthRequest, res) => {
  try {
    await User.updateOne(
      { id: req.userId },
      {
        $set: {
          ticktickAccessToken: "",
          ticktickRefreshToken: "",
          ticktickTokenExpiresAt: 0,
          ticktickDefaultProjectId: "",
        },
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// GET /api/integrations/ticktick/status
app.get("/api/integrations/ticktick/status", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findOne({ id: req.userId });
    const isConnected = Boolean(user && user.ticktickAccessToken);
    res.json({
      connected: isConnected,
      defaultProjectId: user?.ticktickDefaultProjectId || "",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// GET /api/integrations/ticktick/projects
app.get("/api/integrations/ticktick/projects", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findOne({ id: req.userId });
    if (!user || !user.ticktickAccessToken) {
      res.status(400).json({ error: "TickTick not connected" });
      return;
    }

    let token = user.ticktickAccessToken;
    if (user.ticktickTokenExpiresAt && Date.now() > user.ticktickTokenExpiresAt - 60000) {
      if (user.ticktickRefreshToken) {
        const refreshed = await refreshTickTickToken(user.ticktickRefreshToken);
        user.ticktickAccessToken = refreshed.access_token;
        user.ticktickRefreshToken = refreshed.refresh_token;
        user.ticktickTokenExpiresAt = Date.now() + refreshed.expires_in * 1000;
        await user.save();
        token = refreshed.access_token;
      }
    }

    const projects = await listTickTickProjects(token);
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// POST /api/integrations/ticktick/push
app.post("/api/integrations/ticktick/push", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { bookmarkId, projectId, dueDate } = req.body;
    if (!bookmarkId) {
      res.status(400).json({ error: "bookmarkId is required" });
      return;
    }

    const bookmark = await Bookmark.findOne({ id: bookmarkId, userId: req.userId });
    if (!bookmark) {
      res.status(404).json({ error: "Bookmark not found" });
      return;
    }

    const user = await User.findOne({ id: req.userId });
    if (!user || !user.ticktickAccessToken) {
      res.status(400).json({ error: "TickTick account not connected" });
      return;
    }

    let token = user.ticktickAccessToken;
    if (user.ticktickTokenExpiresAt && Date.now() > user.ticktickTokenExpiresAt - 60000) {
      if (user.ticktickRefreshToken) {
        const refreshed = await refreshTickTickToken(user.ticktickRefreshToken);
        user.ticktickAccessToken = refreshed.access_token;
        user.ticktickRefreshToken = refreshed.refresh_token;
        user.ticktickTokenExpiresAt = Date.now() + refreshed.expires_in * 1000;
        await user.save();
        token = refreshed.access_token;
      }
    }

    let targetProjectId = projectId || user.ticktickDefaultProjectId;
    if (!targetProjectId) {
      targetProjectId = await getOrCreateMarkbelProject(token);
      user.ticktickDefaultProjectId = targetProjectId;
      await user.save();
    }

    const taskContent = `URL: ${bookmark.url}\n\nGroup: ${bookmark.group}\n${bookmark.description ? "Description: " + bookmark.description : ""}`;
    const task = await createTickTickTask(token, {
      title: `[Bookmark] ${bookmark.title}`,
      content: taskContent,
      projectId: targetProjectId,
      dueDate: dueDate || bookmark.remindAt || undefined,
    });

    bookmark.ticktickTaskId = task.id;
    bookmark.ticktickProjectId = targetProjectId;
    await bookmark.save();

    res.json({ success: true, task });
  } catch (err: any) {
    console.error("[TickTick Push Error]:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEB PUSH & NOTIFICATIONS ROUTES (CRON TRIGGERED)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/push/vapid-key
app.get("/api/push/vapid-key", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe
app.post("/api/push/subscribe", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { endpoint, keys, deviceLabel } = req.body;
    if (!endpoint || !keys) {
      res.status(400).json({ error: "Endpoint and keys are required" });
      return;
    }

    await PushSubscription.updateOne(
      { userId: req.userId, endpoint },
      {
        $set: {
          id: crypto.randomUUID(),
          userId: req.userId,
          endpoint,
          keys,
          deviceLabel: deviceLabel || "Web Client",
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// DELETE /api/push/unsubscribe
app.delete("/api/push/unsubscribe", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await PushSubscription.deleteOne({ userId: req.userId, endpoint });
    } else {
      await PushSubscription.deleteMany({ userId: req.userId });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// Helper: send push payload safely
async function sendPushNotificationSafely(sub: any, payload: any) {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys,
      },
      JSON.stringify(payload)
    );
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await PushSubscription.deleteOne({ endpoint: sub.endpoint });
    } else {
      console.warn("[Push Notification Error]:", err.message);
    }
  }
}

// POST /api/push/send-test (1-Click Test Push Notification)
app.post("/api/push/send-test", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const subscriptions = await PushSubscription.find({ userId: req.userId }).lean();
    if (subscriptions.length === 0) {
      res.status(400).json({ error: "No push subscriptions found for your account. Enable push notifications first!" });
      return;
    }

    const payload = {
      title: "Markbel Push Test 🔖",
      body: "Instant Push Notification test successful! Notifications are working on this device.",
      url: "/",
    };

    let count = 0;
    for (const sub of subscriptions) {
      await sendPushNotificationSafely(sub, payload);
      count++;
    }

    res.json({ success: true, sent: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// POST /api/notifications/digest (Triggered by cron-job.org)
app.post("/api/notifications/digest", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const secretQuery = req.query.secret;
    const isAuthorized =
      (authHeader && authHeader === `Bearer ${CRON_SECRET}`) ||
      secretQuery === CRON_SECRET;

    if (!isAuthorized) {
      res.status(403).json({ error: "Unauthorized cron trigger" });
      return;
    }

    const subscriptions = await PushSubscription.find().lean();
    let sentCount = 0;

    const userSubsMap = new Map<string, any[]>();
    subscriptions.forEach((sub) => {
      const list = userSubsMap.get(sub.userId) || [];
      list.push(sub);
      userSubsMap.set(sub.userId, list);
    });

    for (const [userId, subs] of userSubsMap.entries()) {
      const unreadCount = await Bookmark.countDocuments({
        userId,
        isArchived: { $ne: true },
        isRead: { $ne: true },
      });

      if (unreadCount === 0) continue;

      const now = new Date().toISOString();
      const dueCount = await Bookmark.countDocuments({
        userId,
        isArchived: { $ne: true },
        isRead: { $ne: true },
        remindAt: { $ne: "", $lte: now },
      });

      let bodyText = `You have ${unreadCount} unread bookmark${unreadCount > 1 ? "s" : ""}.`;
      if (dueCount > 0) {
        bodyText += ` ${dueCount} due today!`;
      }

      const payload = {
        title: "Markbel Daily Digest 🔖",
        body: bodyText,
        url: "/",
      };

      for (const sub of subs) {
        await sendPushNotificationSafely(sub, payload);
        sentCount++;
      }
    }

    res.json({ success: true, notificationsSent: sentCount });
  } catch (err: any) {
    console.error("[Cron Digest Error]:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// POST /api/notifications/due-check (Triggered by cron-job.org every 30m)
app.post("/api/notifications/due-check", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const secretQuery = req.query.secret;
    const isAuthorized =
      (authHeader && authHeader === `Bearer ${CRON_SECRET}`) ||
      secretQuery === CRON_SECRET;

    if (!isAuthorized) {
      res.status(403).json({ error: "Unauthorized cron trigger" });
      return;
    }

    const now = new Date().toISOString();
    const subscriptions = await PushSubscription.find().lean();
    let sentCount = 0;

    const userSubsMap = new Map<string, any[]>();
    subscriptions.forEach((sub) => {
      const list = userSubsMap.get(sub.userId) || [];
      list.push(sub);
      userSubsMap.set(sub.userId, list);
    });

    for (const [userId, subs] of userSubsMap.entries()) {
      const dueBookmarks = await Bookmark.find({
        userId,
        isArchived: { $ne: true },
        isRead: { $ne: true },
        remindAt: { $ne: "", $lte: now },
      }).lean();

      if (dueBookmarks.length === 0) continue;

      const payload = {
        title: "Markbel Due Reminders ⏰",
        body: `You have ${dueBookmarks.length} bookmark${dueBookmarks.length > 1 ? "s" : ""} waiting to be read!`,
        url: "/?filter=due",
      };

      for (const sub of subs) {
        await sendPushNotificationSafely(sub, payload);
        sentCount++;
      }
    }

    // --- TickTick Two-Way Sync (Background) ---
    const usersWithTickTick = await User.find({ ticktickAccessToken: { $ne: "" } }).lean();
    for (const user of usersWithTickTick) {
      if (!user.ticktickAccessToken) continue;

      let token = user.ticktickAccessToken;
      if (user.ticktickTokenExpiresAt && Date.now() > user.ticktickTokenExpiresAt - 60000) {
        if (user.ticktickRefreshToken) {
          try {
            const refreshed = await refreshTickTickToken(user.ticktickRefreshToken);
            await User.updateOne(
              { id: user.id },
              {
                $set: {
                  ticktickAccessToken: refreshed.access_token,
                  ticktickRefreshToken: refreshed.refresh_token,
                  ticktickTokenExpiresAt: Date.now() + refreshed.expires_in * 1000,
                },
              }
            );
            token = refreshed.access_token;
          } catch (e) {
            console.error("[TickTick Background Refresh Error]:", e);
            continue;
          }
        }
      }

      const syncBookmarks = await Bookmark.find({
        userId: user.id,
        isRead: { $ne: true },
        ticktickTaskId: { $exists: true, $ne: "" },
        ticktickProjectId: { $exists: true, $ne: "" },
      });

      for (const bm of syncBookmarks) {
        try {
          const taskData = await getTickTickTask(token, bm.ticktickProjectId!, bm.ticktickTaskId!);
          // TickTick status 2 is completed, status -1 is archived/deleted
          if (taskData && taskData.status !== 0) {
            bm.isRead = true;
            bm.readAt = new Date().toISOString();
            await bm.save();
          }
        } catch (e) {
          console.error(`[TickTick Sync Error for Task ${bm.ticktickTaskId}]:`, e);
        }
      }
    }

    res.json({ success: true, notificationsSent: sentCount });
  } catch (err: any) {
    console.error("[Cron Due Check Error]:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LINK METADATA SCRAPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/bookmarks/meta?url=xxx
app.get(
  "/api/bookmarks/meta",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const urlStr = req.query.url as string;
      if (!urlStr) {
        res.status(400).json({ error: "URL is required" });
        return;
      }

      const parsedUrl = new URL(urlStr);

      // Check for YouTube URLs to extract the video ID
      let ytId: string | null = null;
      if (parsedUrl.hostname.includes("youtube.com")) {
        if (parsedUrl.pathname.startsWith("/watch")) {
          ytId = parsedUrl.searchParams.get("v");
        } else if (parsedUrl.pathname.startsWith("/embed/")) {
          ytId = parsedUrl.pathname.split("/")[2];
        } else if (parsedUrl.pathname.startsWith("/shorts/")) {
          ytId = parsedUrl.pathname.split("/")[2];
        }
      } else if (parsedUrl.hostname.includes("youtu.be")) {
        ytId = parsedUrl.pathname.slice(1);
      }

      let title = "";
      let description = "";
      let image = ytId
        ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
        : "";

      // Attempt to fetch page content, failing gracefully
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        let userAgent =
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36";
        if (parsedUrl.hostname.includes("instagram.com")) {
          userAgent =
            "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_codedoc.html)";
        }

        const response = await fetch(parsedUrl.toString(), {
          headers: {
            "User-Agent": userAgent,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const html = await response.text();

          const getMetaTag = (property: string) => {
            const regex = new RegExp(
              `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
              "i",
            );
            const match = html.match(regex);
            if (match) return match[1];
            const altRegex = new RegExp(
              `<meta[^]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
              "i",
            );
            const altMatch = html.match(altRegex);
            return altMatch ? altMatch[1] : "";
          };

          const getTitle = () => {
            const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            return match ? match[1] : "";
          };

          title =
            getMetaTag("og:title") || getMetaTag("twitter:title") || getTitle();
          description =
            getMetaTag("og:description") ||
            getMetaTag("twitter:description") ||
            "";

          if (!ytId) {
            image = getMetaTag("og:image") || getMetaTag("twitter:image") || "";
            if (image && !image.startsWith("http")) {
              image = new URL(image, parsedUrl.origin).toString();
            }
          }
        }
      } catch (fetchErr) {
        console.warn(
          "[API Meta Fetch Warning] Failed to fetch external page details:",
          fetchErr,
        );
      }

      const decodeHtml = (str: string) => {
        return str
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      };

      const finalTitle = title
        ? decodeHtml(title.trim())
        : ytId
          ? "YouTube Video"
          : parsedUrl.hostname;
      const finalDesc = description ? decodeHtml(description.trim()) : "";

      res.json({
        title: finalTitle,
        description: finalDesc,
        image: image.trim(),
      });
    } catch (err: any) {
      console.error("[API Bookmarks Meta GET] Error:", err);
      res.json({ title: "", description: "", image: "" }); // Fail gracefully
    }
  },
);

// Start server local
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Markbel Server] Running on http://localhost:${PORT}`);
  });
}

// vercel
export default app;
