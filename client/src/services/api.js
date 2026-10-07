import axios from 'axios'

export const TOKEN_STORAGE_KEY = 'thesis_management_token'
export const AUTH_INVALID_EVENT = 'thesis-auth-invalid'

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, ''),
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      window.dispatchEvent(new Event(AUTH_INVALID_EVENT))
    }
    return Promise.reject(error)
  },
)

export const getApiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') =>
  error.response?.data?.message || fallback

export default api
