import express from "express"
import cors from "cors"
import jobRoute from "./routes/jobRoute.js"
import helmet from "helmet"
import dotenv from "dotenv"
import compression from "compression"
import path from "path"
import { fileURLToPath } from "url"
import { connectDB } from "./database/db.js"
import authRoute from "./routes/authRoute.js"
import userRoute from "./routes/userRoute.js"
import newsRoute from "./routes/newsRoute.js"
import hackathonRoute from "./routes/hackathonRoute.js"
import playlistRoute from "./routes/playlistRoute.js"
import roadmapRoute from "./routes/roadmapRoute.js"
import clubRoute from "./routes/clubRoute.js"
import adminRoute from "./routes/adminRoute.js"
import { authLimiter, newsLimiter, apiLimiter, adminLimiter } from "./middleware/rateLimiter.js"
import { startHackathonSyncJob } from "./cron/hackathonSync.js"
import { ensurePlaylistsSeeded } from "./services/playlistCatalogSeed.js"
import { ensureRoadmapsSeeded } from "./services/roadmapSeedService.js"
import { ensureClubsSeeded } from "./controllers/clubController.js"
import { fetchAndCacheNews } from "./services/newsService.js"
import cookieParser from "cookie-parser"

dotenv.config()
const clean = (value) => (value || "").trim().replace(/^"|"$/g, "")
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const requiredEnv = ["MONGO_URI", "JWT_SECRET"]
const missingEnv = requiredEnv.filter((env) => !clean(process.env[env]))
if (missingEnv.length > 0) {
  console.error("Critical Error: Missing required environment variables:", missingEnv.join(", "))
  process.exit(1)
}

const app = express()
app.set("trust proxy", 1)

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))
app.use(compression())

const allowedOrigins = (() => {
  const origins = new Set(["http://localhost:5173", "http://localhost:3000"])

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS
      .split(",")
      .map((o) => clean(o).replace(/\/$/, ""))
      .filter(Boolean)
      .forEach((o) => origins.add(o))
  }

  if (process.env.CLIENT_URL) {
    origins.add(clean(process.env.CLIENT_URL).replace(/\/$/, ""))
  }

  return [...origins]
})()

const allowVercelPreviewOrigins =
  String(process.env.ALLOW_VERCEL_PREVIEW_ORIGINS || "true").toLowerCase() === "true"

const allowedOriginMatchers = allowedOrigins.map((origin) => {
  if (origin === "*") return { type: "all" }
  if (origin.includes("*")) {
    const regex = new RegExp(`^${escapeRegex(origin).replace(/\\\*/g, ".*")}$`)
    return { type: "pattern", regex }
  }
  return { type: "exact", value: origin }
})

const isOriginAllowed = (origin) =>
  allowedOriginMatchers.some((matcher) => {
    if (matcher.type === "all") return true
    if (matcher.type === "exact") return matcher.value === origin
    if (matcher.type === "pattern") return matcher.regex.test(origin)
    return false
  })

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (isOriginAllowed(origin)) return callback(null, true)
    if (allowVercelPreviewOrigins && /\.vercel\.app$/i.test(origin)) return callback(null, true)
    if (process.env.NODE_ENV !== "production") return callback(null, true)
    callback(new Error(`CORS: origin '${origin}' not allowed`))
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  optionsSuccessStatus: 200
}))

app.use(cookieParser())
app.use(express.json({ limit: "2mb" }))
app.use(express.urlencoded({ extended: true, limit: "2mb" }))

app.use("/api/auth", authLimiter, authRoute)
app.use("/api/user", apiLimiter, userRoute)
app.use("/api/news", newsLimiter, newsRoute)
app.use("/api/hackathons", apiLimiter, hackathonRoute)
app.use("/api/jobs", apiLimiter, jobRoute)
app.use("/api/playlists", apiLimiter, playlistRoute)
app.use("/api/roadmaps", apiLimiter, roadmapRoute)
app.use("/api/clubs", apiLimiter, clubRoute)
app.use("/api/admin", adminLimiter, adminRoute)

app.get("/api/health", async (req, res) => {
  const { getEmailStatus } = await import("./utils/emailEnv.js")
  res.json({
    success: true,
    status: "ok",
    email: getEmailStatus()
  })
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

if (process.env.NODE_ENV === "production") {
  if (process.env.SERVE_STATIC === "true") {
    const staticDir = path.join(__dirname, "../client/dist")
    // Serve static files with 1 year cache for hashed assets
    app.use(express.static(staticDir, {
      maxAge: '1y',
      immutable: true,
      index: false
    }))

    app.get("*", (req, res) => {
      res.sendFile(path.join(staticDir, "index.html"), {
        maxAge: '1h' // Cache index.html for only 1 hour
      })
    })
  } else {
    // Production API-only mode (frontend on Vercel, backend on Render)
    app.get("/", (req, res) => {
      res.json({ success: true, message: "TechPlus API Server Running", env: "production" })
    })
  }
} else {
  app.get("/", (req, res) => {
    res.json({ success: true, message: "TechPlus Server Running" })
  })
}

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not found" })
})

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  const status = err.status || 500
  res.status(status).json({
    success: false,
    message: err.message || "Internal Server Error"
  })
})

// ── Process-level error handlers (prevent silent crashes on Render) ──────────
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message)
  console.error(err.stack)
  process.exit(1)
})

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason)
})

const PORT = process.env.PORT || 5000

let httpServer = null

const logStartupStatus = async () => {
  const { getEmailStatus } = await import("./utils/emailEnv.js")
  const status = getEmailStatus()
  console.log(`Email: canSend=${status.canSendEmail} smtp=${status.smtpConfigured} relay=${status.relayConfigured} user=${status.smtpUser || "MISSING"}`)
  if (status.relayForced && !status.relayConfigured) {
    console.error("EMAIL_FORCE_RELAY is true but relay is not configured (CLIENT_URL + EMAIL_RELAY_SECRET)")
  }
}

const startHttpServer = () =>
  new Promise((resolve, reject) => {
    httpServer = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      logStartupStatus()
      resolve(httpServer)
    })

    httpServer.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the existing server, or set PORT to a free port and point the client at that port.`)
      }
      reject(err)
    })
  })

// ── Graceful shutdown (handles Render SIGTERM on free-tier spin-down) ────────
const shutdown = (signal) => {
  console.log(`\n${signal} received — shutting down gracefully...`)
  if (httpServer) {
    httpServer.close(() => {
      console.log("HTTP server closed")
      process.exit(0)
    })
    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      console.error("Forced exit after timeout")
      process.exit(1)
    }, 10000)
  } else {
    process.exit(0)
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

// Initialize server first, then run non-blocking startup tasks
const initializeServer = async () => {
  try {
    await connectDB()
    await startHttpServer()

    // Start background jobs immediately (non-blocking)
    startHackathonSyncJob()

    // Always seed clubs after the server is already accepting requests.
    setImmediate(() => {
      ensureClubsSeeded().catch(() => {})
    })
    //Roadmaps
    setImmediate(() => {
      ensureRoadmapsSeeded()
        .then((r) => console.log("Roadmaps seeded:", r.count))
        .catch((e) => console.error("Roadmap seed failed:", e.message))
    })
    //Resources
    setImmediate(() => {
  ensurePlaylistsSeeded()
    .then(() => console.log("Playlists seeded"))
    .catch((e) => console.error("Playlist seed failed:", e.message))
})
//news data
setImmediate(() => {
  fetchAndCacheNews()
    .then((r) => console.log("News cached:", r.total))
    .catch((e) => console.error("News fetch failed:", e.message))
})
    // Defer non-critical warmup tasks so cold Render instances can answer auth first.
    if (process.env.ENABLE_STARTUP_WARMUPS === "true") {
      setTimeout(() => {
        Promise.allSettled([
          ensurePlaylistsSeeded(),
          ensureRoadmapsSeeded(),
          fetchAndCacheNews()
        ])
          .then((results) => {
            const successful = results.filter(r => r.status === 'fulfilled').length
            console.log(`Startup warmups completed: ${successful}/${results.length} successful`)
          })
          .catch(() => {})
      }, 30000)
    }
  } catch (err) {
    console.error("Failed to start server:", err.message)
    process.exit(1)
  }
}

initializeServer()
