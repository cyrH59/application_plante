import { getSupabaseClient } from "./supabase-client.js?v=6";

export async function getCurrentUser() {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const supabase = await getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signInWithPassword(email, password) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Supabase n'est pas configure.");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email, password) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Supabase n'est pas configure.");

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function listGardens() {
  const supabase = await getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from("gardens").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function ensureDefaultGarden() {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const gardens = await listGardens();
  if (gardens.length > 0) return gardens[0];

  const { data: garden, error: gardenError } = await supabase
    .from("gardens")
    .insert({ owner_id: user.id, name: "Mon jardin" })
    .select()
    .single();

  if (gardenError) throw gardenError;

  const { error: memberError } = await supabase.from("garden_members").insert({
    garden_id: garden.id,
    user_id: user.id,
    role: "owner"
  });

  if (memberError) throw memberError;
  return garden;
}

export async function listPlants(gardenId) {
  const supabase = await getSupabaseClient();
  if (!supabase || !gardenId) return [];

  const { data, error } = await supabase
    .from("plants")
    .select("*, plant_photos(*)")
    .eq("garden_id", gardenId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function upsertPlant(gardenId, plant) {
  const supabase = await getSupabaseClient();
  if (!supabase || !gardenId) return null;

  const payload = toPlantRow(gardenId, plant);
  const { data, error } = await supabase.from("plants").upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deletePlant(plantId) {
  const supabase = await getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from("plants").delete().eq("id", plantId);
  if (error) throw error;
}

export async function logPlantAction(plantId, type, value = {}) {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("plant_actions")
    .insert({
      plant_id: plantId,
      type,
      value,
      created_by: user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadPlantPhoto({ plantId, file, takenAt, caption }) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Supabase n'est pas configure.");

  const extension = file.name.split(".").pop() || "jpg";
  const path = `${plantId}/${crypto.randomUUID()}.${extension.toLowerCase()}`;

  const { error: uploadError } = await supabase.storage.from("plant-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("plant_photos")
    .insert({
      plant_id: plantId,
      storage_path: path,
      taken_at: takenAt,
      caption,
      is_primary: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPhotoUrl(storagePath) {
  const supabase = await getSupabaseClient();
  if (!supabase || !storagePath) return "";

  const { data, error } = await supabase.storage.from("plant-photos").createSignedUrl(storagePath, 60 * 60);
  if (error) return "";
  return data?.signedUrl || "";
}

export function fromPlantRow(row, photoUrl = "") {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    profile: row.profile,
    light: row.exposure,
    placement: row.placement,
    birthDate: row.birth_date,
    healthScore: row.health_score,
    status: row.status,
    cemeteryDate: row.cemetery_date,
    cemeteryReason: row.cemetery_reason,
    notes: row.notes || "",
    photo: photoUrl,
    photos: row.plant_photos || [],
    createdAt: new Date(row.created_at).getTime(),
    lastWateredAt: new Date(row.last_watered_at).getTime(),
    waterLevel: Number(row.water_level),
    lastFertilizedAt: new Date(row.last_fertilized_at).getTime(),
    fertilization: row.fertilization,
    wateringOverride: row.watering_override
  };
}

function toPlantRow(gardenId, plant) {
  return {
    id: plant.id,
    garden_id: gardenId,
    name: plant.name,
    category: plant.category,
    profile: plant.profile,
    placement: plant.placement,
    exposure: plant.light,
    birth_date: plant.birthDate || null,
    health_score: plant.healthScore || 7,
    status: plant.status || "active",
    cemetery_date: plant.cemeteryDate || null,
    cemetery_reason: plant.cemeteryReason || null,
    notes: plant.notes || null,
    water_level: plant.waterLevel ?? 100,
    last_watered_at: new Date(plant.lastWateredAt || Date.now()).toISOString(),
    last_fertilized_at: new Date(plant.lastFertilizedAt || Date.now()).toISOString(),
    fertilization: plant.fertilization || { mode: "auto", manualSchedule: {} },
    watering_override: plant.wateringOverride || null,
    updated_at: new Date().toISOString()
  };
}
