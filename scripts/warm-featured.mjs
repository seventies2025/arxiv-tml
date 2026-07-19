import { readFeatured, generateFeatured } from "../server/ai.mjs";
import { recentPool } from "../server/arxiv.mjs";

async function warmFeatured() {
  const existing = await readFeatured();
  if (existing) {
    console.log(`Existing featured cached until: ${new Date(existing.expires).toLocaleString()}`);
    if (existing.expires > Date.now()) {
      console.log("Cache is still valid, no need to regenerate");
      process.exit(0);
    }
  }
  
  console.log("Generating new featured papers...");
  const pool = await recentPool(["cs.LG", "stat.ML", "quant-ph", "cs.AI"], { perCategory: 18 });
  console.log(`Candidate pool: ${pool.length} papers`);
  
  const featured = await generateFeatured(pool);
  if (featured) {
    console.log(`Generated ${featured.picks.length} featured papers`);
    console.log(`Cached until: ${new Date(featured.expires).toLocaleString()}`);
    process.exit(0);
  } else {
    console.error("Failed to generate featured papers");
    process.exit(1);
  }
}

warmFeatured().catch(console.error);