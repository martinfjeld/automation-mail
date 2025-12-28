# Sanity Integration

This document explains how the Sanity CMS integration works in the Figma Automator.

## Overview

When generating content for a company, the system will automatically:

1. **Capture Screenshots**: Takes desktop (1440x900) and mobile (393x852) screenshots of the company website
2. **Upload to Sanity**: Uploads the screenshots as "before" images
3. **Create Presentation**: Creates a new presentation document in Sanity with the before images populated

## Configuration

Add these environment variables to your `.env` file:

```bash
SANITY_PROJECT_ID=your_project_id
SANITY_DATASET=production
SANITY_TOKEN=your_sanity_token
```

Get these values from your Sanity project at https://www.sanity.io/manage

## How It Works

### 1. Screenshot Capture

The `ScreenshotService` captures two screenshots:

- **Desktop**: 1440x900 (16:10 aspect ratio)
- **Mobile**: 393x852 (131:284 aspect ratio)

### 2. Upload to Sanity

The `SanityService` handles:

- Converting base64 screenshots to buffers
- Uploading as PNG images to Sanity
- Creating asset references

### 3. Presentation Structure

A presentation document is created with three slides:

```typescript
{
  _type: 'presentation',
  customerName: 'Company Name',
  uniqueId: 'company-name-123456789',
  description: 'Presentation for Company Name',
  isPublished: false,
  slides: [
    // Slide 1: Title
    {
      slideType: 'title',
      heading: 'Company Name',
      subheading: 'Presentasjon'
    },
    // Slide 2: Before & After (only before images populated)
    {
      slideType: 'beforeAfter',
      heading: 'Før & etter',
      subheading: 'Before & After',
      beforeImage: { /* Desktop screenshot */ },
      beforeImageMobile: { /* Mobile screenshot */ }
      // afterImage and afterImageMobile are empty
    },
    // Slide 3: Thank You
    {
      slideType: 'thankYou',
      heading: 'Takk for oppmerksomheten'
    }
  ]
}
```

### 4. After Images (Manual)

The "after" images are intentionally left empty so you can:

1. Open the presentation in your Sanity Studio
2. Add the appropriate "after" images based on your industry preset
3. Customize the presentation as needed

## Workflow Integration

The Sanity integration is part of the main generate flow:

1. Scrape company info from Proff.no ✓
2. Enrich with AI ✓
3. Generate email content ✓
4. **Capture screenshots** ← NEW
5. **Upload to Sanity** ← NEW
6. Create Notion entry ✓
7. Return response with Sanity presentation ID ✓

## API Response

The generate endpoint now returns:

```typescript
{
  success: true,
  data: {
    companyName: "Company Name",
    contactPerson: "Contact Name",
    email: "contact@company.com",
    phone: "+47 12345678",
    website: "https://company.com",
    emailContent: "...",
    notionPageId: "notion-page-id",
    industry: "Technology",
    sanityPresentationId: "sanity-document-id", // NEW
    hasScreenshots: true // NEW
  }
}
```

## Optional Feature

If Sanity credentials are not configured:

- The system will skip the Sanity integration
- All other features continue to work normally
- A warning is logged: "⚠️ Sanity credentials not found - skipping Sanity integration"

## Error Handling

If screenshot capture or Sanity upload fails:

- The error is logged but doesn't break the flow
- The email generation and Notion entry still complete
- The response will have `sanityPresentationId: null` and `hasScreenshots: false`

## Future Enhancement: Updating After Images

The `SanityService` includes a method for updating after images programmatically:

```typescript
await sanityService.updatePresentationAfterImages(
  presentationId,
  afterDesktopBase64,
  afterMobileBase64
);
```

This can be used in a future feature to automatically generate "after" mockups.
