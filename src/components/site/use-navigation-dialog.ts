"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Native dialogs provide focus containment, Escape dismissal, and focus restoration.
export function useNavigationDialog(desktopWidth: number) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${desktopWidth}px)`);
    const dismiss = () => {
      if (query.matches) dialogRef.current?.close();
    };
    query.addEventListener("change", dismiss);
    return () => query.removeEventListener("change", dismiss);
  }, [desktopWidth]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return {
    dialogRef,
    open,
    show: () => {
      dialogRef.current?.showModal();
      setOpen(true);
    },
    close: () => dialogRef.current?.close(),
    onClose: () => setOpen(false),
    pathname,
  };
}
