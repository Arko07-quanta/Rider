import Cookies from "js-cookie";

export function checkAuthAndRedirect() {
  let isExpired = true;
  try {
    const authInfoStr = Cookies.get("auth_info");
    if (authInfoStr) {
      const authInfo = JSON.parse(authInfoStr);
      if (authInfo.exp > Date.now()) {
        isExpired = false;
      }
    }
  } catch {}

  if (isExpired) {
    Cookies.remove("auth_info");
    window.location.href = "/login";
  }
}