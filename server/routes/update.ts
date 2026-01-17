import { Router, Request, Response } from "express";
import { NotionService } from "../services/notionService";
import { SanityService } from "../services/sanityService";
import { HistoryService } from "../services/historyService";

const router = Router();
const historyService = new HistoryService();

router.patch("/", async (req: Request, res: Response) => {
  const requestId = `REQ_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  console.log(`\n🟦 ========== UPDATE REQUEST START [${requestId}] ==========`);
  console.log(`🟦 Timestamp: ${new Date().toISOString()}`);

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
      contactDate,
      followUpDate,
    } = req.body;

    console.log(`🟦 [${requestId}] 📝 Update request for pageId: ${pageId}`);
    console.log(`🟦 [${requestId}] Company name: ${companyName}`);
    console.log(`🟦 [${requestId}] linkedIn: '${linkedIn}'`);
    console.log(`🟦 [${requestId}] contactDate: '${contactDate}'`);
    console.log(`🟦 [${requestId}] followUpDate: '${followUpDate}'`);

    if (!pageId) {
      console.error(`🔴 [${requestId}] Missing pageId`);
      return res.status(400).json({
        success: false,
        error: "Page ID is required",
      });
    }

    const notionToken = process.env.NOTION_TOKEN;
    const notionDatabaseId = process.env.NOTION_DATABASE_ID;

    // Initialize Notion service only if credentials are available
    console.log(`🟦 [${requestId}] Checking Notion credentials...`);
    console.log(`🟦 [${requestId}] Has notionToken:`, !!notionToken);
    console.log(`🟦 [${requestId}] Has notionDatabaseId:`, !!notionDatabaseId);

    let notionService: NotionService | null = null;
    if (notionToken && notionDatabaseId) {
      try {
        console.log(`🟦 [${requestId}] Initializing Notion service...`);
        notionService = new NotionService(notionToken, notionDatabaseId);
        console.log(`🟦 [${requestId}] ✅ Notion service initialized`);
      } catch (error: any) {
        console.error(
          `🔴 [${requestId}] Failed to initialize Notion service:`,
          error.message
        );
        // Continue without Notion - local updates will still work
      }
    } else {
      console.warn(
        `🟡 [${requestId}] ⚠️ Notion credentials not found, skipping Notion sync`
      );
    }

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
      contactDate?: string;
      followUpDate?: string;
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
    if (contactDate !== undefined) updates.contactDate = contactDate;
    if (followUpDate !== undefined) updates.followUpDate = followUpDate;

    // Update Notion (with error handling to not block other updates)
    let notionUpdateSuccess = false;
    if (notionService) {
      try {
        console.log(
          `🟦 [${requestId}] 🔄 Calling Notion API to update entry...`
        );
        console.log(
          `🟦 [${requestId}] Notion updates:`,
          JSON.stringify(updates, null, 2)
        );
        const notionStartTime = Date.now();

        await notionService.updateEntry(pageId, updates);

        const notionDuration = Date.now() - notionStartTime;
        notionUpdateSuccess = true;
        console.log(
          `🟦 [${requestId}] ✅ Notion updated successfully in ${notionDuration}ms`
        );
      } catch (notionError: any) {
        console.error(
          `🔴 [${requestId}] ❌ Notion update failed:`,
          notionError.message
        );
        console.error(`🔴 [${requestId}] Error details:`, notionError);
        // Don't fail the entire request if Notion update fails
      }
    } else {
      console.log(
        `🟡 [${requestId}] ⏭️ Skipping Notion update (service not available)`
      );
    }

    // If company name is being updated and sanityPresentationId is provided, update Sanity as well
    let newPresentationUrl: string | undefined = undefined;
    let sanityUpdateSuccess = false;
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
          sanityUpdateSuccess = true;
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

            // Update the presentation URL in Notion (with error handling)
            if (notionService) {
              try {
                await notionService.updateEntry(pageId, {
                  presentationUrl: newPresentationUrl,
                });
                console.log("✅ Presentation URL updated in Notion");
              } catch (notionUrlError: any) {
                console.error(
                  "❌ Failed to update presentation URL in Notion:",
                  notionUrlError.message
                );
              }
            }
          }
        } catch (sanityError: any) {
          console.error("❌ Failed to update Sanity:", sanityError.message);
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
      if (contactPersonUrl !== undefined)
        historyUpdates.contactPersonUrl = contactPersonUrl;
      if (emailContent !== undefined)
        historyUpdates.emailContent = emailContent;
      if (imagesGenerated !== undefined)
        historyUpdates.imagesGenerated = imagesGenerated;
      if (emailSent !== undefined) historyUpdates.emailSent = emailSent;
      if (automationText1 !== undefined)
        historyUpdates.automationText1 = automationText1;
      if (automationText2 !== undefined)
        historyUpdates.automationText2 = automationText2;
      if (leadStatus !== undefined) historyUpdates.leadStatus = leadStatus;
      if (logoMode !== undefined) historyUpdates.logoMode = logoMode;
      if (linkedIn !== undefined) historyUpdates.linkedIn = linkedIn;
      if (meetingDates !== undefined)
        historyUpdates.meetingDates = meetingDates;
      if (bookingLinks !== undefined)
        historyUpdates.bookingLinks = bookingLinks;
      if (emailLocked !== undefined) historyUpdates.emailLocked = emailLocked;

      console.log(
        `📝 Updating history for pageId: ${pageId}, updates:`,
        historyUpdates
      );
      historyService.updateEntry(pageId, historyUpdates);
      console.log(`✅ History update completed for pageId: ${pageId}`);
    } catch (historyError: any) {
      console.error("❌ Failed to update history:", historyError.message);
      // Don't fail the entire request if history update fails
    }

    console.log(`🟦 [${requestId}] ========== UPDATE COMPLETE ==========`);
    console.log(`🟦 [${requestId}] Results:`);
    console.log(`🟦 [${requestId}]   - History: ✅`);
    console.log(
      `🟦 [${requestId}]   - Sanity: ${sanityUpdateSuccess ? "✅" : "⏭️"}`
    );
    console.log(
      `🟦 [${requestId}]   - Notion: ${notionUpdateSuccess ? "✅" : "❌"}`
    );
    console.log(`🟦 [${requestId}] Sending response...\n`);

    res.json({
      success: true,
      notionSuccess: notionUpdateSuccess,
      message: "Update completed",
      presentationUrl: newPresentationUrl,
    });
  } catch (error: any) {
    console.error("❌ Critical update error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process update request",
    });
  }
});

export default router;
