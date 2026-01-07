import express from "express";
import { UrlShortenerService } from "../services/urlShortenerService";

const router = express.Router();
const shortener = new UrlShortenerService();

// POST /api/short-urls - Create a new short URL
router.post("/", async (req, res) => {
  try {
    const { fullUrl } = req.body;

    if (!fullUrl) {
      return res.status(400).json({ error: "fullUrl is required" });
    }

    // Validate URL format
    try {
      new URL(fullUrl);
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const code = shortener.createShortUrl(fullUrl);
    const shortUrl = `www.no-offence.io/s/${code}`;

    res.json({
      code,
      fullUrl,
      shortUrl,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating short URL:", error);
    res.status(500).json({ error: "Failed to create short URL" });
  }
});

// GET /api/short-urls - List all short URLs (optional, for debugging)
router.get("/", async (req, res) => {
  try {
    const urls = shortener.getAllUrls();
    res.json(urls);
  } catch (error) {
    console.error("Error listing short URLs:", error);
    res.status(500).json({ error: "Failed to list short URLs" });
  }
});

// DELETE /api/short-urls - Clear all short URLs
router.delete("/", async (req, res) => {
  try {
    shortener.clearAll();
    res.json({ success: true, message: "All short URLs cleared" });
  } catch (error) {
    console.error("Error clearing short URLs:", error);
    res.status(500).json({ error: "Failed to clear short URLs" });
  }
});

export default router;
