import axios from 'axios';

// In development: VITE_API_URL is empty → Vite proxy handles /api → localhost:5000
// In production on Vercel: VITE_API_URL = https://n8tern-backend.onrender.com
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

export default api;
