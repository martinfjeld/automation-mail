/**
 * Test file to verify Sanity integration
 *
 * This file demonstrates how the Sanity service works
 */

import { SanityService } from "./server/services/sanityService";

// Example usage (for reference only - don't run this directly)
async function exampleUsage() {
  // Initialize the service
  const sanityService = new SanityService(
    "your-project-id",
    "production",
    "your-token"
  );

  // Example: Create a presentation with screenshots
  const presentationId = await sanityService.createPresentation({
    customerName: "Example Company AS",
    description: "Web presentation for Example Company AS",
    beforeDesktopBase64: "base64-encoded-desktop-screenshot",
    beforeMobileBase64: "base64-encoded-mobile-screenshot",
    industry: "Technology",
    website: "https://example.com",
  });

  console.log("Created presentation:", presentationId);

  // Example: Update with after images (later)
  await sanityService.updatePresentationAfterImages(
    presentationId,
    "base64-encoded-after-desktop",
    "base64-encoded-after-mobile"
  );

  console.log("Updated with after images");
}

export { exampleUsage };
