import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { importMoviesFromApache } from "../lib/movieImporter.js";

function text(value) {
  return String(value || "").trim();
}

function parseArgs(argv) {
  const out = {
    baseUrl: text(process.env.MOVIE_IMPORT_BASE_URL),
    include: text(process.env.MOVIE_IMPORT_INCLUDE).split(",").map((v) => text(v)).filter(Boolean),
    exclude: text(process.env.MOVIE_IMPORT_EXCLUDE).split(",").map((v) => text(v)).filter(Boolean),
    dryRun: false,
    limit: Number(process.env.MOVIE_IMPORT_LIMIT || 0) || 0,
    maxDepth: Number(process.env.MOVIE_IMPORT_MAX_DEPTH || 6) || 6,
    publish: String(process.env.MOVIE_IMPORT_PUBLISH || "true").toLowerCase() !== "false",
    providers: text(process.env.MOVIE_METADATA_PROVIDERS || "imdb,omdb,tmdb")
      .split(",")
      .map((v) => text(v).toLowerCase())
      .filter(Boolean),
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--base-url=")) out.baseUrl = text(a.split("=")[1]);
    else if (a.startsWith("--limit=")) out.limit = Number(a.split("=")[1] || 0) || 0;
    else if (a.startsWith("--max-depth=")) out.maxDepth = Number(a.split("=")[1] || 6) || 6;
    else if (a === "--unpublished") out.publish = false;
    else if (a.startsWith("--providers=")) {
      out.providers = text(a.split("=")[1]).split(",").map((v) => text(v).toLowerCase()).filter(Boolean);
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.baseUrl) {
    throw new Error("Missing base URL. Use --base-url=http://10.1.1.1/data/ or MOVIE_IMPORT_BASE_URL");
  }

  const admin = getSupabaseAdmin();
  const summary = await importMoviesFromApache(admin, {
    baseUrl: opts.baseUrl,
    include: opts.include,
    exclude: opts.exclude,
    dryRun: opts.dryRun,
    limit: opts.limit,
    maxDepth: opts.maxDepth,
    publish: opts.publish,
    providers: opts.providers,
    logger: console,
  });

  console.log("");
  console.log("Done.");
  console.log("Scanned:", summary.scanned_count);
  console.log("Candidates:", summary.candidate_count);
  console.log("Saved:", summary.saved_count);
  console.log("Failed:", summary.failed_count);
  if (summary.dry_run) console.log("Mode: dry-run (no DB write)");
}

main().catch((error) => {
  console.error("Import failed:", error?.message || error);
  process.exit(1);
});

