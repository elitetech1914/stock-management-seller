"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./hero-graphic.module.css";

export function HeroGraphic() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setRevealed(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= .2) {
        setRevealed(true);
        observer.disconnect();
      }
    }, { threshold: .2, rootMargin: "0px 0px -24px 0px" });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.scene}>
        <div aria-hidden="true" className={styles.shapes}>
          <div className={styles.creamShape}>
            <div className={styles.float}>
              <div className={styles.tile}>
                <Image src="/headphones.jpg" alt="" fill sizes="(min-width: 1500px) 205px, (min-width: 1024px) 16vw, 33vw" className={styles.headphones} />
              </div>
            </div>
          </div>
          <div className={styles.brownShape}>
            <div className={styles.float}>
              <div className={styles.tile}>
                <Image src="/nike-sneakers.jpg" alt="" fill sizes="(min-width: 1500px) 224px, (min-width: 1024px) 18vw, 36vw" className={styles.sneakers} />
              </div>
            </div>
          </div>
          <div className={styles.domeShape}>
            <div className={styles.float}>
              <div className={styles.tile}>
                <Image src="/rayban-glasses.jpg" alt="" fill sizes="(min-width: 1500px) 255px, (min-width: 1024px) 21vw, (min-width: 432px) 41vw, 56vw" className={styles.glasses} />
              </div>
            </div>
          </div>
        </div>
        <div ref={cardRef} data-reveal={revealed ? "visible" : "pending"} className={styles.marginCard}>
          <p className={styles.label}>YOUR WHOLESALE PARTNER</p>
          <h2 className={styles.value}>
            <span className={styles.phrase}>Buy Better.</span>{" "}
            <span className={styles.phrase}>Sell More.</span>
          </h2>
          <p className={styles.description}>
            Discover products and competitive wholesale pricing for your business.
          </p>
        </div>
        <noscript><style>{`.${styles.marginCard} { opacity: 1 !important; transform: none !important; }`}</style></noscript>
      </div>
    </div>
  );
}
