import { jwtDecode } from "jwt-decode";

export function isTokenExpired(token: string): boolean {
  try {
    const decoded: any = jwtDecode(token);
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function checkAuthAndRedirect() {
  const token = localStorage.getItem("token");
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
}