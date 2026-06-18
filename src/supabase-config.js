export const supabaseConfig = {
  url: "https://kvhiqtktdnpmnbugegok.supabase.co",
  publishableKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2aGlxdGt0ZG5wbW5idWdlZ29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzA5MzMsImV4cCI6MjA5NzM0NjkzM30.Bi7xpL1n1vbepLZxTyTbSFnH_Fn_QD8njHei_6Q-M5I"
};

export function isSupabaseConfigured() {
  return Boolean(supabaseConfig.url && supabaseConfig.publishableKey);
}
