export const APP_NAME = "Jelling Camping";

export const POWER_UNITS = {
  WATT: "W",
  KILOWATT: "kW",
  KILOWATT_HOUR: "kWh",
} as const;

export const POWER_PRICE_PER_KWH = 2.5; // DKK per kWh

export const CONSUMPTION_THRESHOLDS = {
  LOW: 50,
  MEDIUM: 150,
  HIGH: 300,
} as const;

export const CHART_COLORS = {
  primary: "rgb(59, 130, 246)",
  success: "rgb(16, 185, 129)",
  warning: "rgb(245, 158, 11)",
  danger: "rgb(239, 68, 68)",
} as const;
