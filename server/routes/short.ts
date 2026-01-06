import { Router, Request, Response } from "express";
import { UrlShortenerService } from "../services/urlShortenerService";

const router = Router();
const shortener = new UrlShortenerService();

// Redirect short URL to full URL
router.get("/:code", (req: Request, res: Response) => {
  const { code } = req.params;
  
  const fullUrl = shortener.getFullUrl(code);
  
  if (!fullUrl) {
    return res.status(404).send("Link not found or expired");
  }

  // Redirect to the full booking URL
  res.redirect(fullUrl);
});

export default router;
