export const GRIST_CHART_TYPES = [
  "bar",
  "pie",
  "donut",
  "area",
  "line",
  "scatter",
  "kaplan_meier"
] as const;

export type GristChartType = (typeof GRIST_CHART_TYPES)[number];
