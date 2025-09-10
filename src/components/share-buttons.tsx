"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

interface ShareButtonsProps {
  url?: string;
  text?: string;
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M22 12a10 10 0 1 0-11.57 9.87v-6.99H7.9V12h2.53V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.88h-2.34v6.99A10 10 0 0 0 22 12Z" />
    </svg>
  );
}

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M21.5 8.28c-2.46-.34-4.36-1.89-5.13-3.94-.14-.37-.24-.75-.29-1.15h-3.4v12.02a3.09 3.09 0 1 1-3.09-3.09c.26 0 .52.03.77.09V9.64a6.59 6.59 0 0 0-.77-.05 6.18 6.18 0 1 0 6.18 6.18v-6.2c1.2 1.02 2.73 1.71 4.56 1.88v-3.17Z" />
    </svg>
  );
}

function CopyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function ShareButtons({ url, text }: ShareButtonsProps) {
  const [currentUrl, setCurrentUrl] = useState<string>(url || "");

  useEffect(() => {
    if (!url && typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    }
  }, [url]);

  const shareText = useMemo(
    () => text || "Mirá mi análisis de tiro en IaShot",
    [text]
  );

  const tryWebShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "IaShot", text: shareText, url: currentUrl });
        return true;
      } catch (err) {
        return false;
      }
    }
    return false;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      toast({
        title: "Enlace copiado",
        description: "El enlace del análisis se copió al portapapeles.",
      });
    } catch (e) {
      toast({
        title: "No se pudo copiar",
        description: "Copiá manualmente el enlace de la barra del navegador.",
      });
    }
  };

  const shareFacebook = async () => {
    const shared = await tryWebShare();
    if (shared) return;
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      currentUrl
    )}&quote=${encodeURIComponent(shareText)}`;
    window.open(fbUrl, "_blank", "noopener,noreferrer");
  };

  const shareInstagram = async () => {
    const shared = await tryWebShare();
    if (shared) return;
    await copyToClipboard();
    toast({
      title: "Instagram",
      description: "Instagram no permite compartir por web. Enlace copiado.",
    });
  };

  const shareTikTok = async () => {
    const shared = await tryWebShare();
    if (shared) return;
    await copyToClipboard();
    toast({
      title: "TikTok",
      description: "TikTok no permite compartir por web. Enlace copiado.",
    });
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={shareInstagram} aria-label="Compartir en Instagram">
              <InstagramIcon width={18} height={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Instagram</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={shareTikTok} aria-label="Compartir en TikTok">
              <TikTokIcon width={18} height={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>TikTok</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={shareFacebook} aria-label="Compartir en Facebook">
              <FacebookIcon width={18} height={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Facebook</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={copyToClipboard} aria-label="Copiar enlace">
              <CopyIcon width={18} height={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copiar enlace</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export default ShareButtons;


