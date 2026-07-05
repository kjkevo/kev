import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  getAuthUrl: (platform) =>
    api.get(`/auth/authorize/${platform}`),

  handleCallback: (platform, code, state) =>
    api.post(`/auth/callback/${platform}`, { code, state }),

  getUserPlatforms: (userId) =>
    api.get(`/platforms/${userId}`),
};

export const postsAPI = {
  createPost: (postData) =>
    api.post("/posts/create", postData),

  getUserPosts: (userId, status) =>
    api.get(`/posts/${userId}`, { params: { status } }),

  publishPost: (postId) =>
    api.post(`/posts/${postId}/publish`),

  deletePost: (postId) =>
    api.delete(`/posts/${postId}`),
};

export default api;
