import axios from "axios";
import Cookies from "js-cookie";
import { config } from "../config";

const api = axios.create({
  baseURL: config.API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const logoutApi = async () => {
  try {
    await api.post("/api/auth/logout");
  } catch (err) {
    console.error(err);
  }
  Cookies.remove("auth_info");
  window.location.href = "/login";
};

api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      Cookies.remove("auth_info");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;