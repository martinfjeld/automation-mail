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
        Status: {
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

      const response = await this.client.pages.create({
        parent: { database_id: this.databaseId },
        properties,
      });

      return response.id;
    } catch (error: any) {
      console.error("Notion entry creation failed:", error.message);
      throw new Error("Failed to create Notion entry");
    }
  }
}
