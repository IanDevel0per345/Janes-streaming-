import express from "express";
import dgram from "dgram";
import http from "http";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface DiscoveredDevice {
  location: string;
  usn: string;
  server?: string;
  friendlyName: string;
  manufacturer: string;
  modelName: string;
  udn: string;
  avTransportUrl: string;
  renderingControlUrl: string;
  connectionManagerUrl: string;
}

interface PlayRequest {
  deviceUrl: string;
  mediaUrl: string;
  title?: string;
}

interface DeviceControlRequest {
  deviceUrl: string;
}

interface VolumeRequest extends DeviceControlRequest {
  volume: number;
}

interface SeekRequest extends DeviceControlRequest {
  position: number;
}

interface ApiError {
  error: string;
  detail?: string;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const SSDP_ADDRESS = "239.255.255.250";
const SSDP_PORT = 1900;
const SSDP_DISCOVER_WAIT_MS = 3000;

const SSDP_SEARCH_TARGETS = [
  "ssdp:all",
  "upnp:rootdevice",
  "urn:schemas-upnp-org:device:MediaRenderer:1",
  "urn:schemas-upnp-org:device:MediaServer:1",
];

const PORT = 3005;

// ──────────────────────────────────────────────
// XML Parsing Utilities (regex-based, no deps)
// ──────────────────────────────────────────────

/** Extract text content from the first occurrence of an XML tag. */
function extractXmlTag(xml: string, tagName: string): string {
  const pattern = new RegExp(
    `<${tagName}(?:\s[^>]*)?>\s*([\s\S]*?)\s*</${tagName}>`,
    "i"
  );
  const match = xml.match(pattern);
  return match ? match[1].trim() : "";
}

/** Extract a control URL from a <service> block matching the given serviceType fragment. */
function extractServiceUrl(
  xml: string,
  serviceTypeFragment: string,
  tagName: string
): string {
  const servicePattern = /<service>([\s\S]*?)<\/service>/gi;
  let serviceMatch: RegExpExecArray | null;

  while ((serviceMatch = servicePattern.exec(xml)) !== null) {
    const serviceBlock = serviceMatch[1];
    if (serviceBlock.toLowerCase().includes(serviceTypeFragment.toLowerCase())) {
      const value = extractXmlTag(serviceBlock, tagName);
      if (value) return value;
    }
  }
  return "";
}

// ──────────────────────────────────────────────
// HTTP helpers
// ──────────────────────────────────────────────

/** Fetch a URL and return its body as text. */
function httpGet(url: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    let req: http.ClientRequest;

    try {
      timer = setTimeout(() => {
        req.destroy(new Error(`Request to ${url} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      req = http.get(url, { timeout: timeoutMs }, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timer);
          httpGet(res.headers.location, timeoutMs).then(resolve, reject);
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          clearTimeout(timer);
          const body = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} from ${url}: ${body.slice(0, 500)}`));
          } else {
            resolve(body);
          }
        });
        res.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    } catch (err) {
      if (timer) clearTimeout(timer);
      reject(err);
      return;
    }

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Send a SOAP POST request and return the response body as text. */
function soapPost(
  controlUrl: string,
  serviceType: string,
  action: string,
  bodyXml: string,
  timeoutMs = 5000
): Promise<string> {
  const soapEnvelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">` +
    `<s:Body>` +
    `<u:${action} xmlns:u="${serviceType}">` +
    bodyXml +
    `</u:${action}>` +
    `</s:Body>` +
    `</s:Envelope>`;

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(controlUrl);
    const soapAction = `"${serviceType}#${action}"`;

    const timer = setTimeout(() => {
      req.destroy(new Error(`SOAP ${action} to ${controlUrl} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const postData = Buffer.from(soapEnvelope, "utf-8");

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: soapAction,
        "Content-Length": Buffer.byteLength(postData),
        Connection: "close",
      },
      timeout: timeoutMs,
    };

    let req: http.ClientRequest;

    try {
      req = http.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          clearTimeout(timer);
          const body = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`SOAP ${action} returned HTTP ${res.statusCode}: ${body.slice(0, 500)}`));
          } else {
            resolve(body);
          }
        });
        res.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    } catch (err) {
      clearTimeout(timer);
      reject(err);
      return;
    }

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// ──────────────────────────────────────────────
// SSDP Discovery
// ──────────────────────────────────────────────

interface SsdpResponse {
  location: string;
  usn: string;
  server: string;
}

function sendSsdpSearch(target: string, socket: dgram.Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const message =
      `M-SEARCH * HTTP/1.1\r\n` +
      `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}\r\n` +
      `MAN: \"ssdp:discover\"\r\n` +
      `MX: 3\r\n` +
      `ST: ${target}\r\n` +
      `\r\n`;

    const buffer = Buffer.from(message, "utf-8");
    socket.send(buffer, 0, buffer.length, SSDP_PORT, SSDP_ADDRESS, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function parseSsdpResponse(data: Buffer): SsdpResponse | null {
  const text = data.toString("utf-8");

  // Skip if not an SSDP response or NOTIFY
  if (!text.startsWith("HTTP/1.1 200") && !text.startsWith("NOTIFY *")) {
    return null;
  }

  const lines = text.split("\r\n");
  let location = "";
  let usn = "";
  let server = "";

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "location") location = value;
    else if (key === "usn") usn = value;
    else if (key === "server") server = value;
  }

  if (!location) return null;
  return { location, usn, server };
}

async function discoverDevices(): Promise<DiscoveredDevice[]> {
  console.log("[DLNA] Starting SSDP discovery...");

  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  const responses = new Map<string, SsdpResponse>(); // keyed by location to dedup

  await new Promise<void>((resolve) => {
    socket.on("message", (data: Buffer) => {
      const parsed = parseSsdpResponse(data);
      if (parsed && parsed.location && !responses.has(parsed.location)) {
        responses.set(parsed.location, parsed);
        console.log(`[DLNA] SSDP response from ${parsed.location} (USN: ${parsed.usn})`);
      }
    });

    socket.on("error", (err) => {
      console.error("[DLNA] SSDP socket error:", err.message);
    });

    socket.bind(() => {
      socket.setMulticastTTL(2);

      // Fire all search targets
      (async () => {
        for (const target of SSDP_SEARCH_TARGETS) {
          try {
            await sendSsdpSearch(target, socket);
            console.log(`[DLNA] Sent M-SEARCH for ST: ${target}`);
          } catch (err) {
            console.error(`[DLNA] Failed to send M-SEARCH for ${target}:`, (err as Error).message);
          }
        }
      })();

      // Wait for responses
      setTimeout(() => {
        socket.close();
        console.log(`[DLNA] SSDP discovery complete. Found ${responses.size} unique device(s).`);
        resolve();
      }, SSDP_DISCOVER_WAIT_MS);
    });
  });

  // Fetch device description XML for each discovered device
  const devices: DiscoveredDevice[] = [];

  for (const [location, ssdpResp] of responses.entries()) {
    try {
      console.log(`[DLNA] Fetching device description from ${location}`);
      const xml = await httpGet(location, 5000);

      const friendlyName = extractXmlTag(xml, "friendlyName");
      const manufacturer = extractXmlTag(xml, "manufacturer");
      const modelName = extractXmlTag(xml, "modelName");
      const udn = extractXmlTag(xml, "UDN");

      // Extract service control URLs
      const avTransportUrl = extractServiceUrl(
        xml,
        "AVTransport",
        "controlURL"
      );
      const renderingControlUrl = extractServiceUrl(
        xml,
        "RenderingControl",
        "controlURL"
      );
      const connectionManagerUrl = extractServiceUrl(
        xml,
        "ConnectionManager",
        "controlURL"
      );

      // Resolve relative URLs against the device location base
      const baseUrl = new URL(location);
      const resolveUrl = (path: string) => {
        if (!path) return "";
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        return `${baseUrl.protocol}//${baseUrl.host}${path}`;
      };

      const device: DiscoveredDevice = {
        location,
        usn: ssdpResp.usn,
        server: ssdpResp.server,
        friendlyName: friendlyName || "Unknown Device",
        manufacturer: manufacturer || "Unknown",
        modelName: modelName || "Unknown",
        udn: udn || "",
        avTransportUrl: resolveUrl(avTransportUrl),
        renderingControlUrl: resolveUrl(renderingControlUrl),
        connectionManagerUrl: resolveUrl(connectionManagerUrl),
      };

      devices.push(device);
      console.log(`[DLNA] Device: ${device.friendlyName} (${device.manufacturer} ${device.modelName})`);
    } catch (err) {
      console.error(`[DLNA] Failed to fetch description from ${location}:`, (err as Error).message);
    }
  }

  return devices;
}

// ──────────────────────────────────────────────
// AVTransport Service Constants
// ──────────────────────────────────────────────

const AV_TRANSPORT_SERVICE = "urn:schemas-upnp-org:service:AVTransport:1";
const RENDERING_CONTROL_SERVICE = "urn:schemas-upnp-org:service:RenderingControl:1";

/** Extract the AVTransport control URL from a discovered device object's fields. */
function getAvTransportUrl(device: DiscoveredDevice): string {
  if (!device.avTransportUrl) {
    throw new Error("Device does not expose an AVTransport service control URL");
  }
  return device.avTransportUrl;
}

// ──────────────────────────────────────────────
// Express App
// ──────────────────────────────────────────────

const app = express();

// CORS for all origins
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────

/** POST /discover — Discover DLNA/UPnP devices on the local network. */
app.post("/discover", async (_req, res) => {
  try {
    const devices = await discoverDevices();
    res.json(devices);
  } catch (err) {
    console.error("[DLNA] Discovery error:", err);
    const errorResp: ApiError = {
      error: "Discovery failed",
      detail: (err as Error).message,
    };
    res.status(500).json(errorResp);
  }
});

/** POST /play — Set AVTransport URI and start playback. */
app.post("/play", async (req, res) => {
  try {
    const { deviceUrl, mediaUrl, title } = req.body as PlayRequest;

    if (!deviceUrl || !mediaUrl) {
      res.status(400).json({ error: "Missing required fields: deviceUrl, mediaUrl" } as ApiError);
      return;
    }

    // First, discover the device to get the AVTransport URL
    // For play we allow passing a direct control URL or we can do a fresh discover
    // The deviceUrl can be either the AVTransport control URL directly, or a device description URL
    // We'll try to determine: if it looks like a control URL (has /upnp/control or similar), use it directly
    // Otherwise, fetch the device description to find the control URL

    let avTransportUrl = deviceUrl;

    // Check if the URL looks like a device description (XML) vs a control URL
    // A simple heuristic: if it doesn't have known control URL patterns, fetch the XML
    const isLikelyControlUrl =
      deviceUrl.includes("control") ||
      !deviceUrl.endsWith(".xml") && !deviceUrl.includes("description") && !deviceUrl.includes("device");

    if (!isLikelyControlUrl) {
      console.log(`[DLNA] /play: Fetching device description from ${deviceUrl}`);
      const xml = await httpGet(deviceUrl, 5000);
      const baseUrl = new URL(deviceUrl);
      const rawUrl = extractServiceUrl(xml, "AVTransport", "controlURL");
      if (!rawUrl) {
        res.status(400).json({ error: "Device does not have an AVTransport service" } as ApiError);
        return;
      }
      avTransportUrl = rawUrl.startsWith("http")
        ? rawUrl
        : `${baseUrl.protocol}//${baseUrl.host}${rawUrl}`;
    }

    console.log(`[DLNA] /play: Setting AVTransport URI to ${mediaUrl}`);

    // SetAVTransportURI
    const metadataXml = title
      ? `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"><item id="0" parentID="-1" restricted="1"><dc:title>${escapeXml(title)}</dc:title><res protocolInfo="*:*:*:*">${escapeXml(mediaUrl)}</res><upnp:class>object.item.videoItem</upnp:class></item></DIDL-Lite>`
      : "";

    await soapPost(
      avTransportUrl,
      AV_TRANSPORT_SERVICE,
      "SetAVTransportURI",
      `<InstanceID>0</InstanceID><CurrentURI>${escapeXml(mediaUrl)}</CurrentURI><CurrentURIMetaData>${escapeXml(metadataXml)}</CurrentURIMetaData>`
    );
    console.log("[DLNA] /play: SetAVTransportURI succeeded");

    // Play
    console.log("[DLNA] /play: Calling Play...");
    await soapPost(
      avTransportUrl,
      AV_TRANSPORT_SERVICE,
      "Play",
      `<InstanceID>0</InstanceID><Speed>1</Speed>`
    );
    console.log("[DLNA] /play: Play succeeded");

    res.json({ success: true, message: "Playback started" });
  } catch (err) {
    console.error("[DLNA] /play error:", err);
    const errorResp: ApiError = {
      error: "Play failed",
      detail: (err as Error).message,
    };
    res.status(500).json(errorResp);
  }
});

/** POST /pause — Pause playback. */
app.post("/pause", async (req, res) => {
  try {
    const { deviceUrl } = req.body as DeviceControlRequest;

    if (!deviceUrl) {
      res.status(400).json({ error: "Missing required field: deviceUrl" } as ApiError);
      return;
    }

    console.log(`[DLNA] /pause: Pausing on ${deviceUrl}`);
    await soapPost(
      deviceUrl,
      AV_TRANSPORT_SERVICE,
      "Pause",
      `<InstanceID>0</InstanceID>`
    );
    console.log("[DLNA] /pause: Pause succeeded");

    res.json({ success: true, message: "Playback paused" });
  } catch (err) {
    console.error("[DLNA] /pause error:", err);
    const errorResp: ApiError = {
      error: "Pause failed",
      detail: (err as Error).message,
    };
    res.status(500).json(errorResp);
  }
});

/** POST /stop — Stop playback. */
app.post("/stop", async (req, res) => {
  try {
    const { deviceUrl } = req.body as DeviceControlRequest;

    if (!deviceUrl) {
      res.status(400).json({ error: "Missing required field: deviceUrl" } as ApiError);
      return;
    }

    console.log(`[DLNA] /stop: Stopping on ${deviceUrl}`);
    await soapPost(
      deviceUrl,
      AV_TRANSPORT_SERVICE,
      "Stop",
      `<InstanceID>0</InstanceID>`
    );
    console.log("[DLNA] /stop: Stop succeeded");

    res.json({ success: true, message: "Playback stopped" });
  } catch (err) {
    console.error("[DLNA] /stop error:", err);
    const errorResp: ApiError = {
      error: "Stop failed",
      detail: (err as Error).message,
    };
    res.status(500).json(errorResp);
  }
});

/** POST /volume — Set volume (0-100). */
app.post("/volume", async (req, res) => {
  try {
    const { deviceUrl, volume } = req.body as VolumeRequest;

    if (!deviceUrl || volume === undefined) {
      res.status(400).json({ error: "Missing required fields: deviceUrl, volume" } as ApiError);
      return;
    }

    const clampedVolume = Math.max(0, Math.min(100, Math.round(volume)));
    console.log(`[DLNA] /volume: Setting volume to ${clampedVolume} on ${deviceUrl}`);

    await soapPost(
      deviceUrl,
      RENDERING_CONTROL_SERVICE,
      "SetVolume",
      `<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>${clampedVolume}</DesiredVolume>`
    );
    console.log(`[DLNA] /volume: Volume set to ${clampedVolume}`);

    res.json({ success: true, message: `Volume set to ${clampedVolume}` });
  } catch (err) {
    console.error("[DLNA] /volume error:", err);
    const errorResp: ApiError = {
      error: "Volume control failed",
      detail: (err as Error).message,
    };
    res.status(500).json(errorResp);
  }
});

/** POST /seek — Seek to position (seconds). */
app.post("/seek", async (req, res) => {
  try {
    const { deviceUrl, position } = req.body as SeekRequest;

    if (!deviceUrl || position === undefined) {
      res.status(400).json({ error: "Missing required fields: deviceUrl, position" } as ApiError);
      return;
    }

    // Convert seconds to HH:MM:SS format
    const totalSeconds = Math.max(0, Math.round(position));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const target = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    console.log(`[DLNA] /seek: Seeking to ${target} (${position}s) on ${deviceUrl}`);

    await soapPost(
      deviceUrl,
      AV_TRANSPORT_SERVICE,
      "Seek",
      `<InstanceID>0</InstanceID><Unit>REL_TIME</Unit><Target>${target}</Target>`
    );
    console.log(`[DLNA] /seek: Seek to ${target} succeeded`);

    res.json({ success: true, message: `Seeked to ${target}` });
  } catch (err) {
    console.error("[DLNA] /seek error:", err);
    const errorResp: ApiError = {
      error: "Seek failed",
      detail: (err as Error).message,
    };
    res.status(500).json(errorResp);
  }
});

/** GET /status — Get current transport state. */
app.get("/status", async (req, res) => {
  try {
    const deviceUrl = req.query.deviceUrl as string | undefined;

    if (!deviceUrl) {
      res.status(400).json({ error: "Missing required query parameter: deviceUrl" } as ApiError);
      return;
    }

    console.log(`[DLNA] /status: Getting transport info from ${deviceUrl}`);
    const soapResponse = await soapPost(
      deviceUrl,
      AV_TRANSPORT_SERVICE,
      "GetTransportInfo",
      `<InstanceID>0</InstanceID>`
    );

    const currentTransportState = extractXmlTag(soapResponse, "CurrentTransportState");
    const currentTransportStatus = extractXmlTag(soapResponse, "CurrentTransportStatus");
    const currentSpeed = extractXmlTag(soapResponse, "CurrentSpeed");

    console.log(`[DLNA] /status: State=${currentTransportState}, Status=${currentTransportStatus}, Speed=${currentSpeed}`);

    res.json({
      state: currentTransportState || "UNKNOWN",
      status: currentTransportStatus || "UNKNOWN",
      speed: currentSpeed || "1",
      raw: soapResponse,
    } satisfies StatusResponse & { status: string; speed: string });
  } catch (err) {
    console.error("[DLNA] /status error:", err);
    const errorResp: ApiError = {
      error: "Status check failed",
      detail: (err as Error).message,
    };
    res.status(500).json(errorResp);
  }
});

// ──────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────

/** Escape special XML characters. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ──────────────────────────────────────────────
// Start Server
// ──────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[DLNA] DLNA/UPnP service running on port ${PORT}`);
  console.log(`[DLNA] Endpoints:`);
  console.log(`[DLNA]   POST /discover  — Discover devices on the network`);
  console.log(`[DLNA]   POST /play      — Play media on a device`);
  console.log(`[DLNA]   POST /pause     — Pause playback`);
  console.log(`[DLNA]   POST /stop      — Stop playback`);
  console.log(`[DLNA]   POST /volume    — Set volume (0-100)`);
  console.log(`[DLNA]   POST /seek      — Seek to position (seconds)`);
  console.log(`[DLNA]   GET  /status    — Get transport state`);
});
