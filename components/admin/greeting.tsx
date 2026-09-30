"use client";

import { useEffect, useState } from "react";

/** "Good morning / afternoon / evening" based on the admin's own clock. */
export function Greeting() {
  const [text, setText] = useState("Welcome");
  useEffect(() => {
    const h = new Date().getHours();
    setText(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return <h1 className="mb-6 text-4xl font-bold tracking-tight">{text}</h1>;
}
