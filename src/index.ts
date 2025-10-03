import express from "express"
import compression from "compression"
import Database from "./config/db"
import App from "./app"
import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"

const app: express.Application = express()
const port = process.env.PORT || 3000

const shouldCompress = (req: express.Request, res: express.Response) => {
  if (req.headers["x-no-compression"]) return false
  return compression.filter(req, res)
}

app.use(
  compression({
    filter: shouldCompress,
    threshold: 0
  })
)

const httpServer = createServer(app)
const io = new SocketIOServer(httpServer, { cors: { origin: "*" } })

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

const startServer = async () => {
  try {
    await Database.connect()

    App.appConfig(app)

    httpServer.listen(port, () => {
      console.log(
        `${new Date().toLocaleString()} Server running on port: ${port}`
      )
    })

    handleProcessEvents(httpServer)
  } catch (error) {
    console.error("Failed to connect to the database:", error)
    process.exit(1)
  }
}

startServer()

function handleProcessEvents(server: ReturnType<typeof httpServer.listen>) {
  server.on("error", handleError)
  process.on("uncaughtException", handleUncaughtException)
  process.on("unhandledRejection", (reason: unknown) => {
    handleUnhandledRejection(reason, server)
  })
}

function handleError(error: NodeJS.ErrnoException): void {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`)
  } else {
    console.error("Error starting server:", error)
  }
  process.exit(1)
}

function handleUncaughtException(error: Error): void {
  console.error("Uncaught exception:", error)
  process.exit(1)
}

function handleUnhandledRejection(
  reason: unknown,
  server: ReturnType<typeof httpServer.listen>
): void {
  console.error("Unhandled rejection:", reason)
  server.close(() => process.exit(1))
}

export { io }
