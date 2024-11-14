import React, { Suspense } from "react";
import clsx from "clsx";
import styles from "./icon.module.css";

interface IconProps extends React.ComponentProps<"span"> {
  fill?: boolean;
}
const Icon = ({ className, children, fill, ...rest }: IconProps) => {
  return (
    <Suspense
      fallback={
        <span className={clsx(styles["icon"], className)}>
          <span
            style={{
              display: "block",
              width: "var(--md-icon-size,24px)",
              height: "var(--md-icon-size,24px)",
            }}
          />
        </span>
      }
    >
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:FILL@0..1&display=swap"
      />
      <span
        {...rest}
        className={clsx(
          styles["icon"],
          fill ? styles["icon-filled"] : undefined,
          className
        )}
      >
        <i aria-hidden="true">{children}</i>
      </span>
    </Suspense>
  );
};

Icon.displayName = "Actify.Icon";

export { Icon };
