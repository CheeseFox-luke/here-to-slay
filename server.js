import express from 'express'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import WebSocket, { WebSocketServer } from 'ws'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const server = createServer(app)

// Serve the built React app
app.use(express.static(join(__dirname, 'dist')))
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

// In-memory room state
const rooms = new Map()      // roomCode → Set<WebSocket>
const stateCache = new Map() // roomCode → latest game state

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  let currentRoom = null

  ws.on('message', (data) => {
    let msg
    try {
      msg = JSON.parse(data)
    } catch {
      return
    }

    if (msg.type === 'JOIN') {
      const { roomCode } = msg
      if (!roomCode) return

      currentRoom = roomCode

      if (!rooms.has(roomCode)) {
        rooms.set(roomCode, new Set())
      }
      rooms.get(roomCode).add(ws)

      // Send cached state to latecomer if available
      if (stateCache.has(roomCode)) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'STATE', state: stateCache.get(roomCode) }))
        }
      }
    } else if (msg.type === 'UPDATE') {
      const { roomCode, state } = msg
      if (!roomCode || state === undefined) return

      // Cache latest state
      stateCache.set(roomCode, state)

      // Broadcast to all OTHER clients in the room
      const clients = rooms.get(roomCode)
      if (!clients) return
      for (const client of clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'STATE', state }))
        }
      }
    }
  })

  ws.on('close', () => {
    if (currentRoom) {
      const clients = rooms.get(currentRoom)
      if (clients) {
        clients.delete(ws)
        if (clients.size === 0) {
          rooms.delete(currentRoom)
          // Keep state cache so latecomers can still get state when room reforms
        }
      }
    }
  })

  ws.on('error', () => {
    // Handled by close event
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
