export const seasons = {
  hiver: { label: "Hiver", months: [12, 1, 2] },
  printemps: { label: "Printemps", months: [3, 4, 5] },
  ete: { label: "Ete", months: [6, 7, 8] },
  automne: { label: "Automne", months: [9, 10, 11] }
};

export const broadCategories = {
  interieur: "Interieur",
  exterieur: "Exterieur",
  legume: "Legume",
  fruitier: "Fruitier"
};

export const exposureLabels = {
  shade: "ombre",
  partial: "mi-ombre",
  sun: "soleil"
};

export const exposureFit = {
  shade: { shade: 100, partial: 70, sun: 35 },
  partial: { shade: 70, partial: 100, sun: 72 },
  sun: { shade: 35, partial: 76, sun: 100 }
};

export const gaugeThresholds = {
  water: { okAbove: 55, warningAbove: 25 },
  fertilizer: { okAbove: 55, warningAbove: 25 },
  exposure: { okAbove: 75, warningAbove: 50 }
};

export const plantProfiles = {
  succulent: {
    label: "Cactus / succulente",
    preferredExposure: "sun",
    fertilization: {
      printemps: { frequencyPerMonth: 0.5, enabled: true },
      ete: { frequencyPerMonth: 0.5, enabled: true },
      automne: { frequencyPerMonth: 0, enabled: false },
      hiver: { frequencyPerMonth: 0, enabled: false }
    },
    watering: {
      dailyLossPercent: 3,
      heatLossFactor: 0.15,
      alertThresholds: { okAbove: 45, warningAbove: 20 },
      rainGain: { faible: 0, moderee: 3, forte: 8 }
    }
  },
  tropical: {
    label: "Tropicale",
    preferredExposure: "partial",
    fertilization: {
      printemps: { frequencyPerMonth: 1, enabled: true },
      ete: { frequencyPerMonth: 2, enabled: true },
      automne: { frequencyPerMonth: 0.5, enabled: true },
      hiver: { frequencyPerMonth: 0, enabled: false }
    },
    watering: {
      dailyLossPercent: 8,
      heatLossFactor: 0.38,
      alertThresholds: { okAbove: 55, warningAbove: 28 },
      rainGain: { faible: 0, moderee: 0, forte: 0 }
    }
  },
  standard: {
    label: "Classique",
    preferredExposure: "partial",
    fertilization: {
      printemps: { frequencyPerMonth: 1, enabled: true },
      ete: { frequencyPerMonth: 1, enabled: true },
      automne: { frequencyPerMonth: 0.5, enabled: true },
      hiver: { frequencyPerMonth: 0, enabled: false }
    },
    watering: {
      dailyLossPercent: 6,
      heatLossFactor: 0.25,
      alertThresholds: { okAbove: 55, warningAbove: 25 },
      rainGain: { faible: 4, moderee: 10, forte: 18 }
    }
  },
  potager: {
    label: "Potager gourmand",
    preferredExposure: "sun",
    fertilization: {
      printemps: { frequencyPerMonth: 2, enabled: true },
      ete: { frequencyPerMonth: 2, enabled: true },
      automne: { frequencyPerMonth: 0.5, enabled: true },
      hiver: { frequencyPerMonth: 0, enabled: false }
    },
    watering: {
      dailyLossPercent: 12,
      heatLossFactor: 0.5,
      alertThresholds: { okAbove: 60, warningAbove: 32 },
      rainGain: { faible: 5, moderee: 15, forte: 25 }
    }
  },
  fruitier: {
    label: "Fruitier",
    preferredExposure: "sun",
    fertilization: {
      printemps: { frequencyPerMonth: 1, enabled: true },
      ete: { frequencyPerMonth: 1, enabled: true },
      automne: { frequencyPerMonth: 0.5, enabled: true },
      hiver: { frequencyPerMonth: 0, enabled: false }
    },
    watering: {
      dailyLossPercent: 7,
      heatLossFactor: 0.3,
      alertThresholds: { okAbove: 55, warningAbove: 25 },
      rainGain: { faible: 5, moderee: 15, forte: 25 }
    }
  }
};

export const rainBands = {
  faible: { min: 1, max: 5 },
  moderee: { min: 5, max: 20 },
  forte: { min: 20, max: Infinity }
};

export const weatherRiskRules = {
  gel: { label: "Gel", threshold: 0, severity: 7 },
  canicule: { label: "Canicule", threshold: 32, severity: 7 },
  fortesPluies: { label: "Fortes pluies", threshold: 20, severity: 7 },
  secheresse: { label: "Secheresse", maxRain7d: 2, minTemp: 28, severity: 6 },
  ventFort: { label: "Vent fort", threshold: 60, severity: 6 },
  orage: { label: "Orages violents", severity: 8, weatherCodes: [95, 96, 99] }
};
