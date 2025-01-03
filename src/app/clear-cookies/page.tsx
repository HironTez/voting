"use client";

import { useEffect, useState } from "react";
import { useCookies } from "react-cookie";

export default function ClearCookiesPage() {
  const [cleared, setCleared] = useState(false);

  const usernameTag = "username";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [cookies, _setCookie, removeCookie] = useCookies([usernameTag]);

  useEffect(() => {
    if (cookies[usernameTag]) {
      removeCookie(usernameTag);
      setCleared(true);
    }
  }, [cookies, removeCookie]);

  return <>{cleared ? "cleared" : "haven't found"}</>;
}
