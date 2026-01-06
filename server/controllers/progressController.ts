import { Request, Response } from "express";

class ProgressController {
  private clients: Map<string, Response> = new Map();

  // SSE endpoint for progress updates
  streamProgress(req: Request, res: Response): void {
    const clientId = req.query.clientId as string;
    
    if (!clientId) {
      res.status(400).json({ error: "clientId is required" });
      return;
    }

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Store client
    this.clients.set(clientId, res);

    // Send initial connection message
    this.sendProgress(clientId, "Connected to progress stream");

    // Clean up on close
    req.on("close", () => {
      this.clients.delete(clientId);
    });
  }

  // Send progress to specific client
  sendProgress(clientId: string, message: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.write(`data: ${JSON.stringify({ message })}\n\n`);
    }
  }

  // Send progress to all clients
  broadcastProgress(message: string): void {
    this.clients.forEach((client) => {
      client.write(`data: ${JSON.stringify({ message })}\n\n`);
    });
  }

  // Get controller instance
  getClients(): Map<string, Response> {
    return this.clients;
  }
}

const progressController = new ProgressController();
export default progressController;
