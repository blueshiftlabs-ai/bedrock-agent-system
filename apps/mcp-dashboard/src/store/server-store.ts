import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MCPServer, ConnectionConfig } from '@/types'

interface ServerState {
  servers: MCPServer[]
  currentServer: MCPServer | null
  connectionConfig: ConnectionConfig
  addServer: (server: Omit<MCPServer, 'id'>) => void
  updateServer: (id: string, updates: Partial<MCPServer>) => void
  removeServer: (id: string) => void
  setCurrentServer: (server: MCPServer | null) => void
  updateConnectionConfig: (config: Partial<ConnectionConfig>) => void
}

const defaultConnectionConfig: ConnectionConfig = {
  serverUrl: 'http://localhost:3000',
  timeout: 10000,
  reconnectAttempts: 5,
  reconnectInterval: 3000,
}

export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      servers: [],
      currentServer: null,
      connectionConfig: defaultConnectionConfig,

      addServer: (serverData) => {
        const newServer: MCPServer = {
          ...serverData,
          id: `server_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        }
        set((state) => ({
          servers: [...state.servers, newServer],
          currentServer: state.currentServer || newServer,
        }))
      },

      updateServer: (id, updates) => {
        set((state) => ({
          servers: state.servers.map((server) =>
            server.id === id ? { ...server, ...updates } : server
          ),
          currentServer:
            state.currentServer?.id === id
              ? { ...state.currentServer, ...updates }
              : state.currentServer,
        }))
      },

      removeServer: (id) => {
        set((state) => {
          const newServers = state.servers.filter((server) => server.id !== id)
          return {
            servers: newServers,
            currentServer:
              state.currentServer?.id === id
                ? newServers[0] || null
                : state.currentServer,
          }
        })
      },

      setCurrentServer: (server) => {
        set({ currentServer: server })
      },

      updateConnectionConfig: (config) => {
        set((state) => ({
          connectionConfig: { ...state.connectionConfig, ...config },
        }))
      },
    }),
    {
      name: 'mcp-dashboard-servers',
      partialize: (state) => ({
        servers: state.servers,
        connectionConfig: state.connectionConfig,
        currentServer: state.currentServer,
      }),
    }
  )
)