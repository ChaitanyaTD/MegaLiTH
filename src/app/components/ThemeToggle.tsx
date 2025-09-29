"use client";

import { useEffect, useState } from "react";

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", initial);
    }
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", next);
    }
    window.localStorage.setItem("theme", next);
  };

  return (
    <button onClick={toggle} className="rounded-md px-3 py-2 text-sm font-semibold border border-gray-400/40 hover:bg-black/5 dark:hover:bg-white/5">
      {theme === "light" ? "Dark" : "Light"} mode
    </button>
  );
}


