"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselImage {
  url: string;
  alt: string;
  title?: string;
  subtitle?: string;
}

interface ImageCarouselProps {
  images: CarouselImage[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showIndicators?: boolean;
  showArrows?: boolean;
  /**
   * Marca a primeira imagem como prioritária (preload). Desligar quando o
   * carrossel está oculto em mobile para não pré-carregar bytes invisíveis.
   */
  priorityFirst?: boolean;
  /** Atributo sizes responsivo para o next/image. */
  sizes?: string;
}

export default function ImageCarousel({
  images,
  autoPlay = true,
  autoPlayInterval = 5000,
  showIndicators = true,
  showArrows = true,
  priorityFirst = true,
  sizes = "(max-width: 767px) calc(100vw - 3rem), (max-width: 1279px) 50vw, 620px",
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const loadedUrlsRef = useRef<Set<string>>(new Set());
  const loadingUrlsRef = useRef<Map<string, Promise<void>>>(new Map());

  const ensureImageLoaded = useCallback((url: string) => {
    if (typeof window === "undefined" || loadedUrlsRef.current.has(url)) {
      return Promise.resolve();
    }

    const pending = loadingUrlsRef.current.get(url);

    if (pending) {
      return pending;
    }

    const nextPromise = new Promise<void>((resolve) => {
      const image = new window.Image();

      image.onload = () => {
        loadedUrlsRef.current.add(url);
        loadingUrlsRef.current.delete(url);
        resolve();
      };

      image.onerror = () => {
        loadingUrlsRef.current.delete(url);
        resolve();
      };

      image.src = url;
    });

    loadingUrlsRef.current.set(url, nextPromise);
    return nextPromise;
  }, []);

  const preloadNearbyImages = useCallback(
    (index: number) => {
      if (images.length <= 1) {
        return;
      }

      const nextIndex = (index + 1) % images.length;
      const nextUrl = images[nextIndex]?.url;

      if (!nextUrl) {
        return;
      }

      const preloadNext = () => {
        void ensureImageLoaded(nextUrl);
      };

      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(preloadNext, { timeout: 1500 });
        return;
      }

      window.setTimeout(preloadNext, 350);
    },
    [ensureImageLoaded, images],
  );

  const goToIndex = useCallback(
    async (nextIndex: number) => {
      const nextImage = images[nextIndex];

      if (!nextImage || isPending || nextIndex === currentIndex) {
        return;
      }

      setIsPending(true);
      await ensureImageLoaded(nextImage.url);
      setCurrentIndex(nextIndex);
      setIsPending(false);
    },
    [currentIndex, ensureImageLoaded, images, isPending],
  );

  useEffect(() => {
    loadedUrlsRef.current.clear();
    loadingUrlsRef.current.clear();
    setCurrentIndex(0);

    if (images.length === 0) {
      return;
    }

    void ensureImageLoaded(images[0].url);
    preloadNearbyImages(0);
  }, [ensureImageLoaded, images, preloadNearbyImages]);

  useEffect(() => {
    if (images.length === 0) {
      return;
    }

    preloadNearbyImages(currentIndex);
  }, [currentIndex, images.length, preloadNearbyImages]);

  useEffect(() => {
    if (!autoPlay || images.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      void goToIndex((currentIndex + 1) % images.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, currentIndex, goToIndex, images.length]);

  if (images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div className="group relative h-full w-full overflow-hidden bg-slate-100">
      <Image
        src={currentImage.url}
        alt={currentImage.alt}
        fill
        priority={priorityFirst && currentIndex === 0}
        fetchPriority={priorityFirst && currentIndex === 0 ? "high" : "auto"}
        loading={priorityFirst && currentIndex === 0 ? "eager" : "lazy"}
        quality={60}
        sizes={sizes}
        className="object-cover object-center"
        onLoad={() => {
          loadedUrlsRef.current.add(currentImage.url);
        }}
      />

      {(currentImage.title || currentImage.subtitle) && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
          {currentImage.title ? (
            <h3 className="text-xl font-bold text-white">{currentImage.title}</h3>
          ) : null}
          {currentImage.subtitle ? (
            <p className="text-sm text-cyan-300">{currentImage.subtitle}</p>
          ) : null}
        </div>
      )}

      {showArrows ? (
        <>
          <button
            onClick={() => void goToIndex((currentIndex - 1 + images.length) % images.length)}
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-cyan-500/80 text-white opacity-0 transition-opacity hover:bg-cyan-600 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-45 md:left-4"
            aria-label="Imagem anterior"
            disabled={isPending}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={() => void goToIndex((currentIndex + 1) % images.length)}
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-cyan-500/80 text-white opacity-0 transition-opacity hover:bg-cyan-600 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-45 md:right-4"
            aria-label="Proxima imagem"
            disabled={isPending}
          >
            <ChevronRight size={24} />
          </button>
        </>
      ) : null}

      {showIndicators && images.length > 1 ? (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => void goToIndex(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === currentIndex
                  ? "w-6 bg-white"
                  : "w-1.5 bg-white/50 hover:bg-white/70"
              }`}
              aria-label={`Ir para slide ${index + 1}`}
              disabled={isPending}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
