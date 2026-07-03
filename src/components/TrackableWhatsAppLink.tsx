"use client";

import { trackWhatsAppClick } from "@/lib/analytics";
import { MessageCircle } from "lucide-react";

interface TrackableWhatsAppLinkProps {
  href: string;
  location: string;
  className?: string;
  children?: React.ReactNode;
}

export default function TrackableWhatsAppLink({
  href,
  location,
  className,
  children,
}: TrackableWhatsAppLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackWhatsAppClick(location)}
      className={className}
    >
      {children ?? (
        <>
          <MessageCircle className="h-4 w-4" />
          <span>WhatsApp</span>
        </>
      )}
    </a>
  );
}
