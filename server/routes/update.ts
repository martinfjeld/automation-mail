import { Router, Request, Response } from "express";
import { NotionService } from "../services/notionService";
import { SanityService } from "../services/sanityService";
import { HistoryService } from "../services/historyService";

const router = Router();
const historyService = new HistoryService();

router.patch("/", async (req: Request, res: Response) => {
  try {
    const {
      pageId,
      companyName,
      email,
      phone,
      emailContent,
      contactPerson,
      contactPersonUrl,
      website,
      service,
      address,
      city,
      linkedIn,
      sanityUrl,
      presentationUrl,
      sanityPresentationId,
      sanityUniqueId,
      imagesGenerated,
      emailSent,
      automationText1,
      automationText2,
      leadStatus,
      logoMode,
      presentationId,
      meetingDates,
      bookingLinks,
      emailLocked,
    } = req.body;

    if (!pageId) {
      return res.status(400).json({
        success: false,
        error: "Page ID is required",
      });
    }

    const notionToken = process.env.NOTION_TOKEN;
    const notionDatabaseId = process.env.NOTION_DATABASE_ID;

    if (!notionToken || !notionDatabaseId) {
      return res.status(500).json({
        success: false,
        error: "Notion configuration missing",
      });
    }

    const notionService = new NotionService(notionToken, notionDatabaseId);

    const updates: {
      companyName?: string;
      email?: string;
      phone?: string;
      emailContent?: string;
      contactPerson?: string;
      contactPersonUrl?: string;
      website?: string;
      service?: string;
      address?: string;
      city?: string;
      linkedIn?: string;
      sanityUrl?: string;
      presentationUrl?: string;
      leadStatus?: string;
    } = {};

    if (companyName !== undefined) updates.companyName = companyName;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (emailContent !== undefined) updates.emailContent = emailContent;
    if (contactPerson !== undefined) updates.contactPerson = contactPerson;
    if (contactPersonUrl !== undefined)
      updates.contactPersonUrl = contactPersonUrl;
    if (website !== undefined) updates.website = website;
    if (service !== undefined) updates.service = service;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (linkedIn !== undefined) updates.linkedIn = linkedIn;
    if (sanityUrl !== undefined) updates.sanityUrl = sanityUrl;
    if (presentationUrl !== undefined)
      updates.presentationUrl = presentationUrl;
    if (leadStatus !== undefined) updates.leadStatus = leadStatus;

    await notionService.updateEntry(pageId, updates);

    // If company name is being updated and sanityPresentationId is provided, update Sanity as well
    let newPresentationUrl: string | undefined = undefined;
    if (companyName !== undefined && sanityPresentationId) {
      const sanityProjectId = process.env.SANITY_PROJECT_ID;
      const sanityDataset = process.env.SANITY_DATASET || "production";
      const sanityToken = process.env.SANITY_TOKEN;

      if (sanityProjectId && sanityToken) {
        try {
          const sanityService = new SanityService(
            sanityProjectId,
            sanityDataset,
            sanityToken
          );
          await sanityService.updateCustomerName(
            sanityPresentationId,
            companyName
          );
          console.log("✅ Company name updated in Sanity");

          // Regenerate presentation URL with new company name
          if (sanityUniqueId) {
            const slugifiedName = companyName
              .toLowerCase()
              .replace(/[^a-z0-9æøå]+/g, "-")
              .replace(/^-+|-+$/g, "");

            newPresentationUrl = `https://www.no-offence.io/presentation/${slugifiedName}/${sanityUniqueId}`;

            console.log("🔄 Company name changed from Notion");
            console.log("   Original name:", companyName);
            console.log("   Slugified:", slugifiedName);
            console.log("   Unique ID:", sanityUniqueId);
            console.log("   ✅ New presentation URL:", newPresentationUrl);

            // Update the presentation URL in Notion
            await notionService.updateEntry(pageId, {
              presentationUrl: newPresentationUrl,
            });
          }
        } catch (sanityError: any) {
          console.error("Failed to update Sanity:", sanityError.message);
          // Don't fail the entire request if Sanity update fails
        }
      }
    }

    // Update logoMode in Sanity if provided
    if (logoMode !== undefined && (sanityPresentationId || presentationId)) {
      const sanityProjectId = process.env.SANITY_PROJECT_ID;
      const sanityDataset = process.env.SANITY_DATASET || "production";
      const sanityToken = process.env.SANITY_TOKEN;
      const presentationIdToUse = presentationId || sanityPresentationId;

      if (sanityProjectId && sanityToken && presentationIdToUse) {
        try {
          const sanityService = new SanityService(
            sanityProjectId,
            sanityDataset,
            sanityToken
          );
          await sanityService.updateLogoMode(presentationIdToUse, logoMode);
          console.log(`✅ Logo mode updated in Sanity to: ${logoMode}`);
        } catch (sanityError: any) {
          console.error(
            "❌ Failed to update logo mode in Sanity:",
            sanityError
          );
        }
      }
    }

    // Update logoMode in Sanity if provided
    if (logoMode !== undefined && (sanityPresentationId || presentationId)) {
      const sanityProjectId = process.env.SANITY_PROJECT_ID;
      const sanityDataset = process.env.SANITY_DATASET || "production";
      const sanityToken = process.env.SANITY_TOKEN;
      const presentationIdToUse = presentationId || sanityPresentationId;

      if (sanityProjectId && sanityToken && presentationIdToUse) {
        try {
          const sanityService = new SanityService(
            sanityProjectId,
            sanityDataset,
            sanityToken
          );
          await sanityService.updateLogoMode(presentationIdToUse, logoMode);
          console.log(`✅ Logo mode updated in Sanity to: ${logoMode}`);
        } catch (sanityError: any) {
          console.error(
            "❌ Failed to update logo mode in Sanity:",
            sanityError
          );
        }
      }
    }

    // Update history
    try {
      const historyUpdates: any = {};
      if (companyName !== undefined) historyUpdates.companyName = companyName;
      if (email !== undefined) historyUpdates.email = email;
      if (phone !== undefined) historyUpdates.phone = phone;
      if (website !== undefined) historyUpdates.website = website;
      if (address !== undefined) historyUpdates.address = address;
      if (city !== undefined) historyUpdates.city = city;
      if (service !== undefined) historyUpdates.service = service;
      if (sanityUrl !== undefined) historyUpdates.sanityUrl = sanityUrl;
      // Use the newly generated presentation URL if available, otherwise use the one from request
      if (newPresentationUrl !== undefined)
        historyUpdates.presentationUrl = newPresentationUrl;
      else if (presentationUrl !== undefined)
        historyUpdates.presentationUrl = presentationUrl;
      if (contactPerson !== undefined)
        historyUpdates.contactPerson = contactPerson;
      if (imagesGenerated !== undefined)
        historyUpdates.imagesGenerated = imagesGenerated;
      if (emailSent !== undefined) historyUpdates.emailSent = emailSent;
      if (automationText1 !== undefined)
        historyUpdates.automationText1 = automationText1;
      if (automationText2 !== undefined)
        historyUpdates.automationText2 = automationText2;
      if (leadStatus !== undefined) historyUpdates.leadStatus = leadStatus;
      if (meetingDates !== undefined)
        historyUpdates.meetingDates = meetingDates;
      if (bookingLinks !== undefined)
        historyUpdates.bookingLinks = bookingLinks;
      if (emailLocked !== undefined) historyUpdates.emailLocked = emailLocked;

      historyService.updateEntry(pageId, historyUpdates);
    } catch (historyError: any) {
      console.error("Failed to update history:", historyError.message);
      // Don't fail the entire request if history update fails
    }

    res.json({
      success: true,
      message: "Entry updated successfully",
      presentationUrl: newPresentationUrl,
    });
  } catch (error: any) {
    console.error("Update error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update Notion entry",
    });
  }
});

export default router;
