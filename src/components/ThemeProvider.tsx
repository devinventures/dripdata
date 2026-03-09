"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("drip-theme") as Theme | null;
    const resolved = stored ?? "dark";
    setTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, []);

  function toggle() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("drip-theme", next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme: mounted ? theme : "dark", toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
