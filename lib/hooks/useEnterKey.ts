import { useEffect } from "react";

export function useEnterKey(callback: () => void, deps: any[] = []) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "TEXTAREA") return;
        callback();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, deps);
}