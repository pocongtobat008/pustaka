import React from "react";

function Skeleton({
    className,
    ...props
}) {
    return (
        (<div
            className={`animate-pulse rounded-md bg-stone-200 dark:bg-[#0d0d0d] ${className}`}
            {...props} />)
    );
}

export { Skeleton };
