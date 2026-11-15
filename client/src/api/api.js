import axios from 'axios';

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:5000' : 'https://dukaansaathi-api.vercel.app'),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

export default api;
