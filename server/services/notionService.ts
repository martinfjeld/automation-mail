import { Client } from "@notionhq/client";

export interface NotionEntry {
  companyName: string;
  contactPerson: string;
  contactPersonUrl?: string;
  email: string;
  phone?: string;
  website: string;
  proffLink: string;
  service: string;
  message: string;
  address?: string;
  city?: string;
  linkedIn?: string;
  sanityUrl?: string;
  presentationUrl?: string;
  leadStatus?: string;
}

export class NotionService {
  private client: Client | null = null;
  private databaseId: string;

  constructor(token?: string, databaseId?: string) {
    if (token && databaseId) {
      this.client = new Client({ auth: token });
      this.databaseId = databaseId;
    } else {
      this.databaseId = "";
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client || !this.databaseId) {
      throw new Error("Notion client not initialized");
    }

    try {
      // Try to retrieve database metadata
      const response = await this.client.databases.retrieve({
        database_id: this.databaseId,
      });

      return !!response.id;
    } catch (error: any) {
      console.error("Notion test failed:", error.message);
      throw new Error("Invalid Notion token or database ID");
    }
  }

  async createEntry(entry: NotionEntry): Promise<string> {
    if (!this.client || !this.databaseId) {
      throw new Error("Notion client not initialized");
    }

    const today = new Date().toISOString().split("T")[0];
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 7);
    const followUp = followUpDate.toISOString().split("T")[0];

    // Truncate message to 2000 characters if needed
    const truncatedMessage =
      entry.message.length > 2000
        ? entry.message.substring(0, 1997) + "..."
        : entry.message;

    try {
      // Build properties object conditionally
      const properties: any = {
        Selskap: {
          title: [
            {
              text: {
                content: entry.companyName,
              },
            },
          ],
        },
        Kontaktperson: {
          rich_text: [
            {
              text: {
                content: entry.contactPerson || "Ikke funnet",
                link: entry.contactPersonUrl
                  ? { url: entry.contactPersonUrl }
                  : null,
              },
            },
          ],
        },
        "Proff-link": {
          url: entry.proffLink,
        },
        Tjeneste: {
          select: {
            name: entry.service,
          },
        },
        "Lead status": {
          select: {
            name: "Ongoing",
          },
        },
        "Contact Date": {
          date: {
            start: today,
          },
        },
        "Follow-up Date": {
          date: {
            start: followUp,
          },
        },
        "Melding jeg sendte": {
          rich_text: [
            {
              text: {
                content: truncatedMessage,
              },
            },
          ],
        },
      };

      // Add optional properties only if they exist
      if (entry.email) {
        properties["E-post"] = {
          email: entry.email,
        };
      }

      if (entry.phone) {
        properties["Telefon"] = {
          phone_number: entry.phone,
        };
      }

      if (entry.website) {
        properties["Hjemmeside"] = {
          url: entry.website,
        };
      }

      if (entry.address) {
        properties["Adresse"] = {
          rich_text: [
            {
              text: {
                content: entry.address,
              },
            },
          ],
        };
      }

      if (entry.city) {
        properties["By"] = {
          rich_text: [
            {
              text: {
                content: entry.city,
              },
            },
          ],
        };
      }

      if (entry.linkedIn) {
        properties["LinkedIn"] = {
          url: entry.linkedIn,
        };
      }

      if (entry.sanityUrl) {
        properties["Sanity"] = {
          url: entry.sanityUrl,
        };
      }

      if (entry.presentationUrl) {
        properties["Presentasjon"] = {
          url: entry.presentationUrl,
        };
      }

      if (entry.leadStatus) {
        properties["Lead status"] = {
          select: {
            name: entry.leadStatus,
          },
        };
      }

      const response = await this.client.pages.create({
        parent: { database_id: this.databaseId },
        properties,
      });

      return response.id;
    } catch (error: any) {
      console.error("Notion entry creation failed:", error.message);
      console.error("Error details:", error);
      throw new Error("Failed to create Notion entry");
    }
  }

  async updateEntry(
    pageId: string,
    updates: {
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
    }
  ): Promise<void> {
    if (!this.client || !this.databaseId) {
      throw new Error("Notion client not initialized");
    }

    try {
      const properties: any = {};

      if (updates.companyName !== undefined) {
        properties["Selskap"] = {
          title: [
            {
              text: {
                content: updates.companyName,
              },
            },
          ],
        };
      }

      if (updates.email !== undefined) {
        properties["E-post"] = {
          email: updates.email || null,
        };
      }

      if (updates.phone !== undefined) {
        properties["Telefon"] = {
          phone_number: updates.phone || null,
        };
      }

      if (updates.emailContent !== undefined) {
        // Truncate email content if needed to fit Notion's limits
        const truncatedContent =
          updates.emailContent.length > 2000
            ? updates.emailContent.substring(0, 1997) + "..."
            : updates.emailContent;

        properties["Melding jeg sendte"] = {
          rich_text: [
            {
              text: {
                content: truncatedContent,
              },
            },
          ],
        };
      }

      if (updates.contactPerson !== undefined) {
        properties["Kontaktperson"] = {
          rich_text: [
            {
              text: {
                content: updates.contactPerson || "Ikke funnet",
                link: updates.contactPersonUrl
                  ? { url: updates.contactPersonUrl }
                  : null,
              },
            },
          ],
        };
      }

      if (updates.website !== undefined) {
        properties["Hjemmeside"] = {
          url: updates.website || null,
        };
      }

      if (updates.service !== undefined) {
        properties["Tjeneste"] = {
          select: {
            name: updates.service,
          },
        };
      }

      if (updates.address !== undefined) {
        properties["Adresse"] = {
          rich_text: [
            {
              text: {
                content: updates.address || "",
              },
            },
          ],
        };
      }

      if (updates.city !== undefined) {
        properties["By"] = {
          rich_text: [
            {
              text: {
                content: updates.city || "",
              },
            },
          ],
        };
      }

      if (updates.linkedIn !== undefined) {
        properties["LinkedIn"] = {
          url: updates.linkedIn || null,
        };
      }

      if (updates.sanityUrl !== undefined) {
        properties["Sanity"] = {
          url: updates.sanityUrl || null,
        };
      }

      if (updates.presentationUrl !== undefined) {
        properties["Presentasjon"] = {
          url: updates.presentationUrl || null,
        };
      }

      if (updates.leadStatus !== undefined) {
        properties["Lead status"] = {
          select: {
            name: updates.leadStatus,
          },
        };
      }

      await this.client.pages.update({
        page_id: pageId,
        properties,
      });
    } catch (error: any) {
      console.error("Notion entry update failed:", error.message);
      throw new Error("Failed to update Notion entry");
    }
  }

  async deleteEntry(pageId: string): Promise<void> {
    if (!this.client || !this.databaseId) {
      throw new Error("Notion client not initialized");
    }

    try {
      // Archive the page (Notion doesn't allow permanent deletion via API)
      await this.client.pages.update({
        page_id: pageId,
        archived: true,
      });

      console.log(`✅ Notion page archived: ${pageId}`);
    } catch (error: any) {
      console.error("Notion entry deletion failed:", error.message);
      throw new Error("Failed to delete Notion entry");
    }
  }

  async getPageProperties(
    pageId: string
  ): Promise<{ emailContent?: string; industry?: string }> {
    if (!this.client) {
      throw new Error("Notion client not initialized");
    }

    try {
      const page = await this.client.pages.retrieve({ page_id: pageId });
      const properties = (page as any).properties;

      let emailContent: string | undefined;
      let industry: string | undefined;

      // Extract "Melding jeg sendte" (email content)
      if (properties["Melding jeg sendte"]?.rich_text?.[0]?.text?.content) {
        emailContent =
          properties["Melding jeg sendte"].rich_text[0].text.content;
      }

      // Extract "Bransje" (industry)
      if (properties["Bransje"]?.rich_text?.[0]?.text?.content) {
        industry = properties["Bransje"].rich_text[0].text.content;
      }

      return { emailContent, industry };
    } catch (error: any) {
      console.error("Failed to fetch page properties:", error.message);
      throw new Error("Failed to fetch page properties from Notion");
    }
  }
}
