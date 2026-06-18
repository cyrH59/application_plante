import { broadCategories, exposureLabels, plantProfiles } from "./src/config.js?v=3";
import {
  getCurrentSeason,
  getExposureMetrics,
  getFertilizationMetrics,
  getWateringMetrics,
  getWeatherRisk
} from "./src/engines.js?v=3";
import { isSupabaseConfigured } from "./src/supabase-config.js?v=6";
import {
  deletePlant as deleteRemotePlant,
  ensureDefaultGarden,
  fromPlantRow,
  getCurrentUser,
  getPhotoUrl,
  listPlants as listRemotePlants,
  logPlantAction,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  uploadPlantPhoto,
  upsertPlant
} from "./src/supabase-repository.js?v=6";

const STORAGE_KEY = "plantcare.plants.v2";
const LEGACY_STORAGE_KEY = "plantcare.plants.v1";
const WEATHER_KEY = "plantcare.weather.v2";
const LEGACY_WEATHER_KEY = "plantcare.weather.v1";

const samplePlants = [
  createSamplePlant("Ficus lyrata", "interieur", "tropical", "partial", "inside", 74, 3, 18),
  createSamplePlant("Tomates cerises", "legume", "potager", "sun", "ground", 88, 1, 8),
  createSamplePlant("Cactus", "interieur", "succulent", "sun", "inside", 56, 17, 55)
];

let plants = loadPlants();
let weather = loadWeather();
let activeFilter = "all";
let installPrompt = null;
let currentUser = null;
let currentGarden = null;
let syncMode = "local";
let syncBusy = false;

const dom = {
  plantList: document.querySelector("#plantList"),
  statusStrip: document.querySelector("#statusStrip"),
  weatherSummary: document.querySelector("#weatherSummary"),
  weatherDetails: document.querySelector("#weatherDetails"),
  locationBtn: document.querySelector("#locationBtn"),
  openPlantFormBtn: document.querySelector("#openPlantFormBtn"),
  plantDialog: document.querySelector("#plantDialog"),
  accountBand: document.querySelector("#accountBand"),
  accountForm: document.querySelector("#accountForm"),
  accountEmail: document.querySelector("#accountEmail"),
  accountPassword: document.querySelector("#accountPassword"),
  accountSummary: document.querySelector("#accountSummary"),
  syncSummary: document.querySelector("#syncSummary"),
  signUpBtn: document.querySelector("#signUpBtn"),
  signOutBtn: document.querySelector("#signOutBtn"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
  plantForm: document.querySelector("#plantForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  plantId: document.querySelector("#plantId"),
  plantName: document.querySelector("#plantName"),
  plantPhoto: document.querySelector("#plantPhoto"),
  plantBirthDate: document.querySelector("#plantBirthDate"),
  plantHealthScore: document.querySelector("#plantHealthScore"),
  healthScoreValue: document.querySelector("#healthScoreValue"),
  plantCategory: document.querySelector("#plantCategory"),
  plantProfile: document.querySelector("#plantProfile"),
  plantLight: document.querySelector("#plantLight"),
  plantPlacement: document.querySelector("#plantPlacement"),
  plantWaterLevel: document.querySelector("#plantWaterLevel"),
  waterLevelValue: document.querySelector("#waterLevelValue"),
  fertilizationMode: document.querySelector("#fertilizationMode"),
  manualFertilizationFields: document.querySelector("#manualFertilizationFields"),
  fertHiver: document.querySelector("#fertHiver"),
  fertPrintemps: document.querySelector("#fertPrintemps"),
  fertEte: document.querySelector("#fertEte"),
  fertAutomne: document.querySelector("#fertAutomne"),
  plantNotes: document.querySelector("#plantNotes"),
  deletePlantBtn: document.querySelector("#deletePlantBtn"),
  backupBtn: document.querySelector("#backupBtn"),
  importInput: document.querySelector("#importInput"),
  installBtn: document.querySelector("#installBtn"),
  template: document.querySelector("#plantCardTemplate")
};

render();
registerEvents();
initializeCloudSync();
registerServiceWorker();

function registerEvents() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderPlants();
    });
  });

  dom.locationBtn.addEventListener("click", requestWeather);
  dom.openPlantFormBtn.addEventListener("click", () => openForm());
  dom.closeDialogBtn.addEventListener("click", closeForm);
  dom.plantForm.addEventListener("submit", savePlantFromForm);
  dom.deletePlantBtn.addEventListener("click", deleteCurrentPlant);
  dom.backupBtn.addEventListener("click", exportData);
  dom.importInput.addEventListener("change", importData);
  dom.installBtn.addEventListener("click", installApp);
  dom.plantWaterLevel.addEventListener("input", updateWaterLevelLabel);
  dom.plantHealthScore.addEventListener("input", updateHealthScoreLabel);
  dom.fertilizationMode.addEventListener("change", syncManualFertilizationVisibility);
  dom.accountForm.addEventListener("submit", handleSignIn);
  dom.signUpBtn.addEventListener("click", handleSignUp);
  dom.signOutBtn.addEventListener("click", handleSignOut);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    dom.installBtn.hidden = false;
  });
}

async function initializeCloudSync() {
  renderAccount();
  if (!isSupabaseConfigured()) return;

  try {
    currentUser = await getCurrentUser();
    if (currentUser) await loadRemoteData();
  } catch (error) {
    setSyncMessage(`Supabase indisponible: ${error.message}`);
  } finally {
    renderAccount();
  }
}

function loadPlants() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samplePlants));
    return samplePlants;
  }

  try {
    const parsed = JSON.parse(raw).map(normalizePlant);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    return samplePlants;
  }
}

function normalizePlant(plant) {
  const profile = plantProfiles[plant.profile] ? plant.profile : "standard";
  return {
    id: plant.id || crypto.randomUUID(),
    name: plant.name || "Plante sans nom",
    category: broadCategories[plant.category] ? plant.category : "interieur",
    profile,
    light: plant.light || plant.exposure || plantProfiles[profile].preferredExposure,
    placement: plant.placement || "inside",
    notes: plant.notes || "",
    photo: plant.photo || "",
    createdAt: plant.createdAt || Date.now(),
    lastWateredAt: plant.lastWateredAt || plant.createdAt || Date.now(),
    waterLevel: Number.isFinite(plant.waterLevel) ? plant.waterLevel : 100,
    lastFertilizedAt: plant.lastFertilizedAt || plant.createdAt || Date.now(),
    birthDate: plant.birthDate || null,
    healthScore: Number(plant.healthScore || 7),
    status: plant.status || "active",
    cemeteryDate: plant.cemeteryDate || null,
    cemeteryReason: plant.cemeteryReason || null,
    fertilization: plant.fertilization || { mode: "auto", manualSchedule: getDefaultManualFertilization() },
    wateringOverride: plant.wateringOverride || null
  };
}

function savePlants() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
}

function loadWeather() {
  const raw = localStorage.getItem(WEATHER_KEY) || localStorage.getItem(LEGACY_WEATHER_KEY);
  if (!raw) return null;

  try {
    return normalizeWeather(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveWeather(nextWeather) {
  weather = nextWeather;
  localStorage.setItem(WEATHER_KEY, JSON.stringify(nextWeather));
}

function render() {
  renderAccount();
  renderWeather();
  renderStatus();
  renderPlants();
}

function renderAccount() {
  const configured = isSupabaseConfigured();
  dom.accountBand.dataset.mode = syncMode;
  dom.accountSummary.textContent = currentUser ? `Connecte: ${currentUser.email}` : configured ? "Supabase pret" : "Mode local";
  if (!dom.syncSummary.dataset.custom) {
    dom.syncSummary.textContent = currentUser
      ? `Synchronisation serveur active${currentGarden ? ` · ${currentGarden.name}` : ""}.`
      : configured
        ? "Connecte-toi pour synchroniser plantes et photos."
        : "Supabase n'est pas encore configure.";
  }
  dom.accountEmail.hidden = Boolean(currentUser);
  dom.accountPassword.hidden = Boolean(currentUser);
  dom.signOutBtn.hidden = !currentUser;
  dom.accountForm.querySelector("#signInBtn").hidden = Boolean(currentUser);
  dom.signUpBtn.hidden = Boolean(currentUser);
}

function renderWeather() {
  if (!weather) {
    dom.weatherSummary.textContent = "Active la position pour adapter arrosage, pluie et risques.";
    dom.weatherDetails.innerHTML = "";
    dom.locationBtn.textContent = "Activer";
    return;
  }

  const risk = getWeatherRisk(weather);
  const updated = new Date(weather.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const riskText = risk.items.length ? risk.items.join(", ") : "Risque faible";

  dom.weatherSummary.textContent = `${weather.temperatureMin7} / ${weather.temperatureMax7} °C · risque ${risk.score}/10 · ${riskText}`;
  dom.weatherDetails.innerHTML = `
    <span>24h: ${weather.rain24} mm</span>
    <span>3j: ${weather.rain3d} mm</span>
    <span>7j: ${weather.rain7d} mm</span>
    <span class="risk-pill ${risk.level}">${risk.score}/10</span>
    <span>Maj ${updated}</span>
  `;
  dom.locationBtn.textContent = "Rafraichir";
}

function renderStatus() {
  const metrics = plants.map((plant) => ({
    water: getWateringMetrics(plant, weather),
    fertilizer: getFertilizationMetrics(plant)
  }));
  const urgentWater = metrics.filter((item) => item.water.state === "danger").length;
  const lateFertilizer = metrics.filter((item) => item.fertilizer.state === "danger").length;
  const soon = metrics.filter((item) => item.water.state === "warn" || item.fertilizer.state === "warn").length;

  const title =
    urgentWater > 0
      ? `${urgentWater} plante${urgentWater > 1 ? "s" : ""} a arroser`
      : lateFertilizer > 0
        ? `${lateFertilizer} fertilisation${lateFertilizer > 1 ? "s" : ""} en retard`
        : "Jardin sous controle";
  const detail =
    urgentWater > 0
      ? "Les cartes rouges demandent une action rapide."
      : soon > 0
        ? `${soon} fiche${soon > 1 ? "s" : ""} a surveiller.`
        : "Aucune urgence pour le moment.";

  dom.statusStrip.innerHTML = `<div><strong>${title}</strong><p>${detail}</p></div><span>${plants.length} fiches</span>`;
}

function renderPlants() {
  const visiblePlants = plants.filter((plant) => plant.status !== "cemetery" && (activeFilter === "all" || plant.category === activeFilter));
  dom.plantList.innerHTML = "";

  if (visiblePlants.length === 0) {
    dom.plantList.innerHTML = `
      <div class="empty-state">
        <h2>Aucune plante ici</h2>
        <p>Ajoute une fiche ou change de categorie pour retrouver ton jardin.</p>
      </div>
    `;
    return;
  }

  visiblePlants
    .sort((a, b) => getWateringMetrics(a, weather).value - getWateringMetrics(b, weather).value)
    .forEach((plant) => {
      const card = dom.template.content.firstElementChild.cloneNode(true);
      const water = getWateringMetrics(plant, weather);
      const fertilizer = getFertilizationMetrics(plant);
      const exposure = getExposureMetrics(plant);
      const profile = plantProfiles[plant.profile] || plantProfiles.standard;

      card.querySelector(".plant-name").textContent = plant.name;
      card.querySelector(".plant-category").textContent = `${broadCategories[plant.category]} · ${profile.label}`;
      card.querySelector(".plant-hint").textContent = getHint(plant, water, fertilizer, exposure);

      const alert = card.querySelector(".plant-alert");
      const mainState = water.state === "danger" || fertilizer.state === "danger" ? "danger" : water.state === "warn" || fertilizer.state === "warn" ? "warn" : "ok";
      alert.textContent = getAlertLabel(mainState);
      alert.classList.toggle("warn", mainState === "warn");
      alert.classList.toggle("danger", mainState === "danger");

      const photo = card.querySelector(".plant-photo");
      if (plant.photo) {
        photo.classList.add("has-photo");
        photo.style.backgroundImage = `url("${plant.photo}")`;
      }

      setGauge(card, "water", water.value, water.state);
      setGauge(card, "fertilizer", fertilizer.value, fertilizer.state, fertilizer.label);
      renderExposureNote(card.querySelector(".exposure-note"), exposure);
      card.dataset.health = plant.healthScore || 7;

      card.querySelector(".water-button").addEventListener("click", () => waterPlant(plant.id));
      card.querySelector(".feed-button").addEventListener("click", () => feedPlant(plant.id));
      card.querySelector(".card-edit").addEventListener("click", () => openForm(plant));

      dom.plantList.append(card);
    });
}

function getAlertLabel(state) {
  if (state === "danger") return "Urgent";
  if (state === "warn") return "Bientot";
  return "OK";
}

function getHint(plant, water, fertilizer, exposure) {
  if ((plant.healthScore || 7) <= 3) return `Sante ${plant.healthScore}/10: plante a surveiller de pres.`;
  if (water.state === "danger") return `Eau basse: ${water.value}%. Dernier arrosage il y a ${water.daysSinceWater} j.`;
  if (fertilizer.state === "danger") return `Fertilisation en retard de ${fertilizer.overdueDays} j.`;
  if (water.rainGain > 0) return `La pluie ajoute environ +${water.rainGain}% a la reserve d'eau.`;
  if (exposure.state === "danger") return "Exposition peu adaptee: verifie l'emplacement de cette plante.";
  if (fertilizer.state === "paused") return `Fertilisation en pause pour la saison ${fertilizer.season}.`;
  return `Perte eau estimee: ${water.dailyLoss}%/j · fertilisation: ${fertilizer.label}.`;
}

function setGauge(card, kind, value, state, label = `${value}%`) {
  const gauge = card.querySelector(`.gauge[data-kind="${kind}"]`);
  gauge.dataset.state = state;
  gauge.querySelector("strong").textContent = label;
  gauge.querySelector(".meter span").style.width = `${value}%`;
}

function renderExposureNote(node, exposure) {
  node.className = `exposure-note ${exposure.state}`;
  node.innerHTML = `
    <span>Exposition</span>
    <strong>${exposureLabels[exposure.current]} / ideal ${exposureLabels[exposure.preferred]}</strong>
  `;
}

function openForm(plant = null) {
  dom.plantForm.reset();
  const currentWater = plant ? getWateringMetrics(plant, weather).value : 100;
  const fertilization = plant?.fertilization || { mode: "auto", manualSchedule: getDefaultManualFertilization() };

  dom.plantId.value = plant?.id || "";
  dom.dialogTitle.textContent = plant ? "Modifier la plante" : "Ajouter une plante";
  dom.deletePlantBtn.hidden = !plant;
  dom.plantWaterLevel.value = currentWater;
  updateWaterLevelLabel();
  dom.plantHealthScore.value = plant?.healthScore || 7;
  updateHealthScoreLabel();

  if (plant) {
    dom.plantName.value = plant.name;
    dom.plantCategory.value = plant.category;
    dom.plantProfile.value = plant.profile;
    dom.plantLight.value = plant.light;
    dom.plantPlacement.value = plant.placement;
    dom.plantBirthDate.value = plant.birthDate || "";
    dom.plantNotes.value = plant.notes || "";
  }

  dom.fertilizationMode.value = fertilization.mode || "auto";
  setManualFertilizationFields(fertilization.manualSchedule || getDefaultManualFertilization());
  syncManualFertilizationVisibility();
  dom.plantDialog.showModal();
}

function closeForm() {
  dom.plantDialog.close();
}

async function savePlantFromForm(event) {
  event.preventDefault();

  const id = dom.plantId.value || crypto.randomUUID();
  const existing = plants.find((plant) => plant.id === id);
  const photoFile = dom.plantPhoto.files[0] || null;
  const localPhoto = photoFile ? await fileToDataUrl(photoFile) : existing?.photo || "";
  const now = Date.now();
  const waterLevel = Number(dom.plantWaterLevel.value);
  const nextPlant = {
    id,
    name: dom.plantName.value.trim(),
    category: dom.plantCategory.value,
    profile: dom.plantProfile.value,
    light: dom.plantLight.value,
    placement: dom.plantPlacement.value,
    notes: dom.plantNotes.value.trim(),
    photo: localPhoto,
    birthDate: dom.plantBirthDate.value || null,
    healthScore: Number(dom.plantHealthScore.value || 7),
    status: existing?.status || "active",
    cemeteryDate: existing?.cemeteryDate || null,
    cemeteryReason: existing?.cemeteryReason || null,
    createdAt: existing?.createdAt || now,
    lastWateredAt: now,
    waterLevel,
    lastFertilizedAt: existing?.lastFertilizedAt || now,
    fertilization: {
      mode: dom.fertilizationMode.value,
      manualSchedule: getManualFertilizationFromForm()
    },
    wateringOverride: existing?.wateringOverride || null
  };

  try {
    setBusy(true);
    if (currentGarden) {
      await upsertPlant(currentGarden.id, nextPlant);
      if (photoFile) {
        const photoRow = await uploadPlantPhoto({
          plantId: nextPlant.id,
          file: photoFile,
          takenAt: new Date().toISOString().slice(0, 10),
          caption: "Photo principale"
        });
        await logPlantAction(nextPlant.id, "photo", { photoId: photoRow.id });
      }
      await loadRemoteData();
      setSyncMessage("Plante sauvegardee sur Supabase.");
    } else {
      plants = existing ? plants.map((plant) => (plant.id === id ? nextPlant : plant)) : [nextPlant, ...plants];
      savePlants();
    }
    closeForm();
    render();
  } catch (error) {
    alert(`Sauvegarde impossible: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function deleteCurrentPlant() {
  const id = dom.plantId.value;
  if (!id) return;
  try {
    if (currentGarden) {
      await deleteRemotePlant(id);
      await loadRemoteData();
    } else {
      plants = plants.filter((plant) => plant.id !== id);
      savePlants();
    }
    closeForm();
    render();
  } catch (error) {
    alert(`Suppression impossible: ${error.message}`);
  }
}

async function waterPlant(id) {
  const updatedAt = Date.now();
  plants = plants.map((plant) => (plant.id === id ? { ...plant, waterLevel: 100, lastWateredAt: updatedAt } : plant));
  savePlants();
  render();
  if (!currentGarden) return;

  const plant = plants.find((item) => item.id === id);
  if (!plant) return;
  try {
    await upsertPlant(currentGarden.id, plant);
    await logPlantAction(id, "watering", { waterLevel: 100 });
    setSyncMessage("Arrosage synchronise.");
  } catch (error) {
    setSyncMessage(`Arrosage local uniquement: ${error.message}`);
  }
}

async function feedPlant(id) {
  const updatedAt = Date.now();
  plants = plants.map((plant) => (plant.id === id ? { ...plant, lastFertilizedAt: updatedAt } : plant));
  savePlants();
  render();
  if (!currentGarden) return;

  const plant = plants.find((item) => item.id === id);
  if (!plant) return;
  try {
    await upsertPlant(currentGarden.id, plant);
    await logPlantAction(id, "fertilization", {});
    setSyncMessage("Fertilisation synchronisee.");
  } catch (error) {
    setSyncMessage(`Fertilisation locale uniquement: ${error.message}`);
  }
}

async function requestWeather() {
  if (!navigator.geolocation) {
    dom.weatherSummary.textContent = "La geolocalisation n'est pas disponible sur cet appareil.";
    return;
  }

  dom.locationBtn.disabled = true;
  dom.locationBtn.textContent = "Lecture...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        await fetchWeather(position.coords.latitude, position.coords.longitude);
      } catch {
        dom.weatherSummary.textContent = "Impossible de joindre la meteo. Les jauges restent en mode local.";
      } finally {
        dom.locationBtn.disabled = false;
        render();
      }
    },
    () => {
      dom.locationBtn.disabled = false;
      dom.locationBtn.textContent = "Activer";
      dom.weatherSummary.textContent = "Position refusee. Tu peux quand meme utiliser les jauges locales.";
    },
    { enableHighAccuracy: false, timeout: 9000, maximumAge: 1000 * 60 * 60 }
  );
}

async function fetchWeather(latitude, longitude) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,relative_humidity_2m,precipitation",
    hourly: "precipitation,temperature_2m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_gusts_10m_max",
    forecast_days: "7",
    timezone: "auto"
  });

  const response = await fetch(url);
  if (!response.ok) throw new Error("Weather request failed");
  const data = await response.json();
  saveWeather(normalizeWeatherData(latitude, longitude, data));
}

function normalizeWeatherData(latitude, longitude, data) {
  const hourlyRain = data.hourly?.precipitation || [];
  const hourlyTemps = data.hourly?.temperature_2m || [];
  const dailyRain = data.daily?.precipitation_sum || [];
  const dailyMax = data.daily?.temperature_2m_max || [];
  const dailyMin = data.daily?.temperature_2m_min || [];
  const gusts = data.daily?.wind_gusts_10m_max || [];

  return {
    latitude,
    longitude,
    temperature: round1(data.current?.temperature_2m || average(hourlyTemps.slice(0, 24)) || 18),
    temperatureMax24: Math.round(Math.max(...hourlyTemps.slice(0, 24), dailyMax[0] || 18)),
    temperatureMin7: Math.round(Math.min(...dailyMin.filter(Number.isFinite))),
    temperatureMax7: Math.round(Math.max(...dailyMax.filter(Number.isFinite))),
    rain24: round1(hourlyRain.slice(0, 24).reduce(sum, 0)),
    rain3d: round1(dailyRain.slice(0, 3).reduce(sum, 0)),
    rain7d: round1(dailyRain.slice(0, 7).reduce(sum, 0)),
    windGustMax7: Math.round(Math.max(...gusts.filter(Number.isFinite), 0)),
    weatherCodes7: data.daily?.weather_code || [],
    updatedAt: Date.now()
  };
}

function normalizeWeather(raw) {
  if (!raw) return null;
  if ("rain24" in raw) return raw;

  const rain = Number(raw.rainNext48 || 0);
  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    temperature: Math.round(raw.temperature || 18),
    temperatureMax24: Math.round(raw.temperature || 18),
    temperatureMin7: Math.round(raw.temperature || 18),
    temperatureMax7: Math.round(raw.temperature || 18),
    rain24: Math.round(rain / 2),
    rain3d: Math.round(rain),
    rain7d: Math.round(rain),
    windGustMax7: 0,
    weatherCodes7: [],
    updatedAt: raw.updatedAt || Date.now()
  };
}

function exportData() {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    plants,
    weather
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `plantcare-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.plants)) throw new Error("Invalid backup");
      plants = data.plants.map(normalizePlant);
      savePlants();
      if (data.weather) saveWeather(normalizeWeather(data.weather));
      render();
    } catch {
      alert("Le fichier d'import n'est pas reconnu.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  dom.installBtn.hidden = true;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

async function handleSignIn(event) {
  event.preventDefault();
  if (!dom.accountEmail.value || !dom.accountPassword.value) return;

  try {
    setBusy(true);
    const { user } = await signInWithPassword(dom.accountEmail.value, dom.accountPassword.value);
    currentUser = user;
    await loadRemoteData();
    setSyncMessage("Connexion reussie. Donnees serveur chargees.");
    dom.accountPassword.value = "";
    render();
  } catch (error) {
    alert(`Connexion impossible: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function handleSignUp() {
  if (!dom.accountEmail.value || !dom.accountPassword.value) return;

  try {
    setBusy(true);
    const { user } = await signUpWithPassword(dom.accountEmail.value, dom.accountPassword.value);
    currentUser = user || (await getCurrentUser());
    if (currentUser) await loadRemoteData();
    setSyncMessage("Compte cree. Verifie tes emails si Supabase demande une confirmation.");
    dom.accountPassword.value = "";
    render();
  } catch (error) {
    alert(`Inscription impossible: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function handleSignOut() {
  try {
    await signOut();
  } finally {
    currentUser = null;
    currentGarden = null;
    syncMode = "local";
    plants = loadPlants();
    setSyncMessage("Deconnecte. Retour au mode local.");
    render();
  }
}

async function loadRemoteData() {
  currentGarden = await ensureDefaultGarden();
  if (!currentGarden) return;

  const rows = await listRemotePlants(currentGarden.id);
  const mapped = await Promise.all(
    rows.map(async (row) => {
      const primary = (row.plant_photos || []).find((photo) => photo.is_primary) || row.plant_photos?.[0];
      const photoUrl = primary ? await getPhotoUrl(primary.storage_path) : "";
      return normalizePlant(fromPlantRow(row, photoUrl));
    })
  );

  plants = mapped;
  savePlants();
  syncMode = "cloud";
}

function setBusy(value) {
  syncBusy = value;
  dom.accountForm.querySelectorAll("button, input").forEach((node) => {
    if (node.id !== "signOutBtn") node.disabled = value;
  });
}

function setSyncMessage(message) {
  dom.syncSummary.dataset.custom = "true";
  dom.syncSummary.textContent = message;
}

function updateWaterLevelLabel() {
  dom.waterLevelValue.textContent = `${dom.plantWaterLevel.value}%`;
}

function updateHealthScoreLabel() {
  dom.healthScoreValue.textContent = `${dom.plantHealthScore.value}/10`;
}

function syncManualFertilizationVisibility() {
  dom.manualFertilizationFields.hidden = dom.fertilizationMode.value !== "manual";
}

function getManualFertilizationFromForm() {
  return {
    hiver: numberRule(dom.fertHiver.value),
    printemps: numberRule(dom.fertPrintemps.value),
    ete: numberRule(dom.fertEte.value),
    automne: numberRule(dom.fertAutomne.value)
  };
}

function setManualFertilizationFields(schedule) {
  dom.fertHiver.value = schedule.hiver?.frequencyPerMonth ?? schedule.hiver ?? 0;
  dom.fertPrintemps.value = schedule.printemps?.frequencyPerMonth ?? schedule.printemps ?? 1;
  dom.fertEte.value = schedule.ete?.frequencyPerMonth ?? schedule.ete ?? 1;
  dom.fertAutomne.value = schedule.automne?.frequencyPerMonth ?? schedule.automne ?? 0.5;
}

function getDefaultManualFertilization() {
  return {
    hiver: numberRule(0),
    printemps: numberRule(1),
    ete: numberRule(1),
    automne: numberRule(0.5)
  };
}

function numberRule(value) {
  const frequencyPerMonth = Number(value || 0);
  return { frequencyPerMonth, enabled: frequencyPerMonth > 0 };
}

function createSamplePlant(name, category, profile, light, placement, waterLevel, waterDaysAgo, fertilizerDaysAgo) {
  return normalizePlant({
    id: crypto.randomUUID(),
    name,
    category,
    profile,
    light,
    placement,
    notes: "",
    photo: "",
    createdAt: daysAgo(30),
    lastWateredAt: daysAgo(waterDaysAgo),
    waterLevel,
    lastFertilizedAt: daysAgo(fertilizerDaysAgo)
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function daysAgo(days) {
  return Date.now() - days * 86_400_000;
}

function sum(total, value) {
  return total + Number(value || 0);
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce(sum, 0) / clean.length : 0;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}
