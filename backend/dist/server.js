import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "./db.js";
import User from "./models/User.js";
import Bookmark from "./models/Bookmark.js";
import { authMiddleware } from "./middleware/auth.js";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_local_dev";
app.use(cors());
app.use(express.json());
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE MIDDLEWARE (Ensure connected before any queries)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.use(async (req, res, next) => {
    try {
        await connectToDatabase();
        next();
    }
    catch (err) {
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
app.post("/api/users/signup", async (req, res) => {
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
    }
    catch (err) {
        console.error("[API Signup] Error:", err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});
// POST /api/users/login
app.post("/api/users/login", async (req, res) => {
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
        }
        else {
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
    }
    catch (err) {
        console.error("[API Login] Error:", err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});
// GET /api/users/me (Get profile)
app.get("/api/users/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ id: req.userId }).lean();
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        const { password, _id, __v, ...safeUser } = user;
        res.json(safeUser);
    }
    catch (err) {
        console.error("[API User Me] Error:", err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});
let sseClients = [];
// Helper to notify clients
function notifyClients(userId, type, data) {
    const payload = JSON.stringify({ type, data });
    sseClients.forEach((client) => {
        if (client.userId === userId) {
            try {
                client.res.write(`data: ${payload}\n\n`);
            }
            catch (err) {
                console.warn("[SSE] Failed to write to client:", err);
            }
        }
    });
}
// GET /api/bookmarks/events (SSE Stream)
app.get("/api/bookmarks/events", (req, res) => {
    const token = req.query.token;
    if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
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
    }
    catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
});
// GET /api/bookmarks
app.get("/api/bookmarks", authMiddleware, async (req, res) => {
    try {
        const bookmarks = await Bookmark.find({ userId: req.userId }).lean();
        res.json(bookmarks);
    }
    catch (err) {
        console.error("[API Bookmarks GET] Error:", err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});
// POST /api/bookmarks
app.post("/api/bookmarks", authMiddleware, async (req, res) => {
    try {
        let { title, url, description, image, group } = req.body;
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
            }
            catch {
                initialTitle = url;
            }
        }
        const payload = {
            title: initialTitle,
            url,
            description: finalDescription,
            image: finalImage,
            group: group || "Unsorted",
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
        notifyClients(req.userId, "bookmark_created", bookmark.toJSON());
        // Perform scraping in the background asynchronously
        if (shouldScrapeTitle || shouldScrapeImage || shouldScrapeDesc) {
            (async () => {
                try {
                    const parsedUrl = new URL(url);
                    // Parse YouTube video ID
                    let ytId = null;
                    if (parsedUrl.hostname.includes("youtube.com")) {
                        if (parsedUrl.pathname.startsWith("/watch")) {
                            ytId = parsedUrl.searchParams.get("v");
                        }
                        else if (parsedUrl.pathname.startsWith("/embed/")) {
                            ytId = parsedUrl.pathname.split("/")[2];
                        }
                        else if (parsedUrl.pathname.startsWith("/shorts/")) {
                            ytId = parsedUrl.pathname.split("/")[2];
                        }
                    }
                    else if (parsedUrl.hostname.includes("youtu.be")) {
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
                            let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36";
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
                                const getMetaTag = (property) => {
                                    const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, "i");
                                    const match = html.match(regex);
                                    if (match)
                                        return match[1];
                                    const altRegex = new RegExp(`<meta[^]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, "i");
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
                                        scrapedImage = new URL(scrapedImage, parsedUrl.origin).toString();
                                    }
                                }
                            }
                        }
                        catch (fetchErr) {
                            console.warn("[Server Auto-Scrape Background] Scraper fetch warning:", fetchErr);
                        }
                    }
                    const decodeHtml = (str) => {
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
                    }
                    else if (shouldScrapeTitle &&
                        ytId &&
                        (updatedTitle === url || updatedTitle === parsedUrl.hostname)) {
                        updatedTitle = "YouTube Video";
                    }
                    if (shouldScrapeImage && scrapedImage) {
                        updatedImage = scrapedImage.trim();
                    }
                    if (shouldScrapeDesc && scrapedDesc) {
                        updatedDescription = decodeHtml(scrapedDesc.trim());
                    }
                    await Bookmark.updateOne({ id: payload.id }, {
                        $set: {
                            title: updatedTitle,
                            image: updatedImage,
                            description: updatedDescription,
                            updatedAt: new Date().toISOString(),
                        },
                    });
                    console.log(`[Server Auto-Scrape Background] Successfully updated bookmark ${payload.id}`);
                    // Notify clients that the bookmark details have been updated!
                    if (payload.userId) {
                        notifyClients(payload.userId, "bookmark_updated", { id: payload.id });
                    }
                }
                catch (backgroundErr) {
                    console.error("[Server Auto-Scrape Background] Error during async crawl:", backgroundErr);
                }
            })();
        }
    }
    catch (err) {
        console.error("[API Bookmarks POST] Error:", err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});
// PUT /api/bookmarks (Uses query ?id=xxx)
app.put("/api/bookmarks", authMiddleware, async (req, res) => {
    try {
        const id = req.query.id;
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
        const incomingTime = new Date(incomingData.updatedAt || new Date().toISOString()).getTime();
        const serverTime = new Date(existingBookmark.updatedAt || new Date().toISOString()).getTime();
        if (incomingTime < serverTime) {
            res.status(409).json(existingBookmark.toJSON());
            return;
        }
        Object.assign(existingBookmark, incomingData);
        existingBookmark.updatedAt = new Date().toISOString();
        await existingBookmark.save();
        res.json(existingBookmark.toJSON());
        // Notify clients of modification
        notifyClients(req.userId, "bookmark_updated", existingBookmark.toJSON());
    }
    catch (err) {
        console.error("[API Bookmarks PUT] Error:", err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});
// PUT /api/bookmarks/group (Rename a group for the current user)
app.put("/api/bookmarks/group", authMiddleware, async (req, res) => {
    try {
        const { oldName, newName } = req.body;
        if (!oldName || !newName) {
            res
                .status(400)
                .json({ error: "Old group name and new group name are required" });
            return;
        }
        const result = await Bookmark.updateMany({ userId: req.userId, group: oldName }, { $set: { group: newName, updatedAt: new Date().toISOString() } });
        res.json({ success: true, modifiedCount: result.modifiedCount });
        // Notify clients of group rename updates
        notifyClients(req.userId, "bookmark_updated");
    }
    catch (err) {
        console.error("[API Bookmarks Group PUT] Error:", err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});
// DELETE /api/bookmarks (Uses query ?id=xxx)
app.delete("/api/bookmarks", authMiddleware, async (req, res) => {
    try {
        const id = req.query.id;
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
        notifyClients(req.userId, "bookmark_deleted", { id });
    }
    catch (err) {
        console.error("[API Bookmarks DELETE] Error:", err);
        res.status(500).json({ error: err.message || "Internal Server Error" });
    }
});
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LINK METADATA SCRAPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/bookmarks/meta?url=xxx
app.get("/api/bookmarks/meta", authMiddleware, async (req, res) => {
    try {
        const urlStr = req.query.url;
        if (!urlStr) {
            res.status(400).json({ error: "URL is required" });
            return;
        }
        const parsedUrl = new URL(urlStr);
        // Check for YouTube URLs to extract the video ID
        let ytId = null;
        if (parsedUrl.hostname.includes("youtube.com")) {
            if (parsedUrl.pathname.startsWith("/watch")) {
                ytId = parsedUrl.searchParams.get("v");
            }
            else if (parsedUrl.pathname.startsWith("/embed/")) {
                ytId = parsedUrl.pathname.split("/")[2];
            }
            else if (parsedUrl.pathname.startsWith("/shorts/")) {
                ytId = parsedUrl.pathname.split("/")[2];
            }
        }
        else if (parsedUrl.hostname.includes("youtu.be")) {
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
            let userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36";
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
                const getMetaTag = (property) => {
                    const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, "i");
                    const match = html.match(regex);
                    if (match)
                        return match[1];
                    const altRegex = new RegExp(`<meta[^]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, "i");
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
        }
        catch (fetchErr) {
            console.warn("[API Meta Fetch Warning] Failed to fetch external page details:", fetchErr);
        }
        const decodeHtml = (str) => {
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
    }
    catch (err) {
        console.error("[API Bookmarks Meta GET] Error:", err);
        res.json({ title: "", description: "", image: "" }); // Fail gracefully
    }
});
// Start server local
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`[Markbel Server] Running on http://localhost:${PORT}`);
    });
}
// vercel
export default app;
