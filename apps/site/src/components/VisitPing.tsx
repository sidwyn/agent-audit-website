"use client";

import { useEffect } from "react";
import { recordVisit } from "../lib/counter";

export function VisitPing() {
  useEffect(() => {
    recordVisit(window.location.pathname);
  }, []);
  return null;
}
