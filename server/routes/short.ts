import { Router, Request, Response } from "express";
import { UrlShortenerService } from "../services/urlShortenerService";

const router = Router();
const shortener = new UrlShortenerService();

// Redirect short URL to full URL
router.get("/:code", (req: Request, res: Response) => {
  const { code } = req.params;
  
  const fullUrl = shortener.getFullUrl(code);
  
  if (!fullUrl) {
    // Check if request wants JSON
    if (req.accepts('json')) {
      return res.status(404).json({ error: "Link not found or expired" });
    }
    return res.status(404).send("Link not found or expired");
  }

  // Check if request wants JSON response instead of redirect
  if (req.accepts('json') && !req.accepts('html')) {
    return res.json({ redirectUrl: fullUrl });
  }

  // Default: redirect to the full booking URL
  res.redirect(fullUrl);
});

export default router;
