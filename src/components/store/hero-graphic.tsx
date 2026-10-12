import styles from "./hero-graphic.module.css";

export function HeroGraphic() {
  return (
    <div className={styles.panel}>
      <div className={styles.scene}>
        <div aria-hidden="true" className={styles.shapes}>
          <span className={styles.creamShape} />
          <span className={styles.brownShape} />
          <span className={styles.domeShape} />
        </div>
        <div className={styles.marginCard}>
          <p className={styles.label}>Retail margin</p>
          <p className={styles.value}>Up to 60%</p>
          <p className={styles.description}>
            Competitive wholesale pricing for growing retailers.
          </p>
        </div>
      </div>
    </div>
  );
}
