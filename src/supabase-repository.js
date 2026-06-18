import { getSupabaseClient } from "./supabase-client.js";

export async function getCurrentUser() {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
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

export async function uploadPlantPhoto({ plantId, file, takenAt, caption }) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error("Supabase n'est pas configure.");

  const extension = file.name.split(".").pop() || "jpg";
  const path = `${plantId}/${crypto.randomUUID()}.${extension}`;

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
      caption
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
