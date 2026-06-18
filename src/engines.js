import {
  exposureFit,
  gaugeThresholds,
  plantProfiles,
  rainBands,
  seasons,
  weatherRiskRules
} from "./config.js";

export function getCurrentSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  return Object.entries(seasons).find(([, season]) => season.months.includes(month))?.[0] || "printemps";
}

export function getWateringMetrics(plant, weather, now = Date.now()) {
  const profile = plantProfiles[plant.profile] || plantProfiles.standard;
  const rule = mergeWateringRule(profile.watering, plant.wateringOverride);
  const baseLevel = Number.isFinite(plant.waterLevel) ? plant.waterLevel : 100;
  const lastWateredAt = plant.lastWateredAt || plant.createdAt || now;
  const days = daysBetween(lastWateredAt, now);
  const heatLoss = weather ? Math.max(0, ((weather.temperatureMax24 ?? weather.temperature ?? 20) - 24) * rule.heatLossFactor) : 0;
  const coldSlowdown = weather ? Math.max(0, (12 - (weather.temperature ?? 18)) * (rule.coldSlowdownFactor || 0.08)) : 0;
  const seasonalFactor = rule.seasonalFactors?.[getCurrentSeason(new Date(now))] ?? 1;
  const dailyLoss = Math.max(0.5, (rule.dailyLossPercent + heatLoss - coldSlowdown) * seasonalFactor);
  const rainGain = getRainGain(plant, weather, rule);
  const value = clamp(baseLevel - days * dailyLoss + rainGain, 0, 100);
  const state = getGaugeState(value, rule.alertThresholds);

  return {
    value: Math.round(value),
    state,
    daysSinceWater: Math.round(days),
    dailyLoss: round1(dailyLoss),
    seasonalFactor,
    rainGain,
    thresholds: rule.alertThresholds
  };
}

export function getFertilizationMetrics(plant, now = Date.now()) {
  const profile = plantProfiles[plant.profile] || plantProfiles.standard;
  const season = getCurrentSeason(new Date(now));
  const schedule = plant.fertilization?.mode === "manual" ? plant.fertilization.manualSchedule : profile.fertilization;
  const rule = normalizeFertilizationRule(schedule?.[season]);
  const lastFertilizedAt = plant.lastFertilizedAt || plant.createdAt || now;
  const days = daysBetween(lastFertilizedAt, now);

  if (!rule.enabled || rule.frequencyPerMonth <= 0) {
    return {
      value: 100,
      state: "paused",
      season,
      frequencyPerMonth: 0,
      dueDays: null,
      daysSinceFertilized: Math.round(days),
      overdueDays: 0,
      label: "Pause saison"
    };
  }

  const dueDays = 30 / rule.frequencyPerMonth;
  const overdueDays = Math.max(0, days - dueDays);
  const value =
    days <= dueDays
      ? 100 - (days / dueDays) * 75
      : 25 - Math.min(25, (overdueDays / dueDays) * 25);
  const state = overdueDays > 0 ? "danger" : getGaugeState(value, gaugeThresholds.fertilizer);

  return {
    value: Math.round(clamp(value, 0, 100)),
    state,
    season,
    frequencyPerMonth: rule.frequencyPerMonth,
    dueDays: Math.round(dueDays),
    daysSinceFertilized: Math.round(days),
    overdueDays: Math.ceil(overdueDays),
    label: overdueDays > 0 ? `${Math.ceil(overdueDays)} j retard` : `Echeance ${Math.round(dueDays)} j`
  };
}

export function getExposureMetrics(plant) {
  const profile = plantProfiles[plant.profile] || plantProfiles.standard;
  const score = exposureFit[profile.preferredExposure]?.[plant.light] ?? 70;
  const state = getGaugeState(score, gaugeThresholds.exposure);

  return {
    score,
    state,
    preferred: profile.preferredExposure,
    current: plant.light
  };
}

export function getWeatherRisk(weather) {
  if (!weather) return { score: 0, level: "ok", items: [] };

  const items = [];
  if ((weather.temperatureMin7 ?? 99) <= weatherRiskRules.gel.threshold) items.push(weatherRiskRules.gel);
  if ((weather.temperatureMax7 ?? 0) >= weatherRiskRules.canicule.threshold) items.push(weatherRiskRules.canicule);
  if ((weather.rain24 ?? 0) >= weatherRiskRules.fortesPluies.threshold) items.push(weatherRiskRules.fortesPluies);
  if ((weather.rain7d ?? 0) <= weatherRiskRules.secheresse.maxRain7d && (weather.temperatureMax7 ?? 0) >= weatherRiskRules.secheresse.minTemp) {
    items.push(weatherRiskRules.secheresse);
  }
  if ((weather.windGustMax7 ?? 0) >= weatherRiskRules.ventFort.threshold) items.push(weatherRiskRules.ventFort);
  if ((weather.weatherCodes7 || []).some((code) => weatherRiskRules.orage.weatherCodes.includes(code))) items.push(weatherRiskRules.orage);

  const score = Math.min(10, items.reduce((max, item) => Math.max(max, item.severity), 0));
  const level = score >= 7 ? "danger" : score >= 4 ? "warn" : "ok";

  return {
    score,
    level,
    items: items.map((item) => item.label)
  };
}

export function getGaugeState(value, thresholds) {
  if (value >= thresholds.okAbove) return "ok";
  if (value >= thresholds.warningAbove) return "warn";
  return "danger";
}

export function getRainBand(rainMm) {
  if (!rainMm || rainMm < rainBands.faible.min) return null;
  return Object.entries(rainBands).find(([, band]) => rainMm >= band.min && rainMm < band.max)?.[0] || "forte";
}

function getRainGain(plant, weather, rule) {
  if (!weather || plant.placement === "inside") return 0;
  const band = getRainBand(weather.rain24 ?? weather.rainNext48 ?? 0);
  if (!band) return 0;
  const placementFactor = plant.placement === "ground" ? 1 : 0.72;
  return Math.round((rule.rainGain[band] || 0) * placementFactor);
}

function mergeWateringRule(baseRule, override = {}) {
  override = override || {};
  return {
    ...baseRule,
    ...override,
    alertThresholds: { ...baseRule.alertThresholds, ...(override.alertThresholds || {}) },
    seasonalFactors: { ...baseRule.seasonalFactors, ...(override.seasonalFactors || {}) },
    rainGain: { ...baseRule.rainGain, ...(override.rainGain || {}) }
  };
}

function normalizeFertilizationRule(rule) {
  if (typeof rule === "number") return { frequencyPerMonth: rule, enabled: rule > 0 };
  return {
    frequencyPerMonth: Number(rule?.frequencyPerMonth || 0),
    enabled: Boolean(rule?.enabled && Number(rule?.frequencyPerMonth || 0) > 0)
  };
}

function daysBetween(start, end) {
  return Math.max(0, (Number(end) - Number(start)) / 86_400_000);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}
