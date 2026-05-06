import type { ReactElement } from "react";

export function preview(): ReactElement {
    return <div>Benchmark Widget</div>;
}

export function getPreviewCss(): string {
    return require("./ui/BenchmarkWidget.css");
}
