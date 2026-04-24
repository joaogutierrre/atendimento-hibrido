import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status
    if (status === 401) {
      localStorage.removeItem('accessToken')
      window.location.href = '/login'
      return Promise.reject(err)
    }
    const msg = err.response?.data?.message ?? err.message ?? 'Erro desconhecido'
    toast.error(Array.isArray(msg) ? msg.join(', ') : String(msg))
    return Promise.reject(err)
  }
)

export default api
