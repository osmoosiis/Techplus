import axios from "axios"

// In-memory cache
let cachedIndianJobs = []
let lastIndianFetchTime = 0
// Cache or retry delay: 24 hours
const INDIAN_CACHE_DURATION = 24 * 60 * 60 * 1000



// ---- Jooble (India) ----
let cachedJoobleJobs = []
let lastJoobleFetchTime = 0
const JOOBLE_CACHE_DURATION = 6 * 60 * 60 * 1000 // 6 hours

async function fetchJoobleIndiaJobs() {
  const key = process.env.JOOBLE_API_KEY
  if (!key) return cachedJoobleJobs
  if (Date.now() - lastJoobleFetchTime < JOOBLE_CACHE_DURATION) return cachedJoobleJobs

  try {
    const { data } = await axios.post(
      `https://jooble.org/api/${key}`,
      { keywords: "software developer", location: "India", page: "1" },
      { timeout: 8000 }
    )

    cachedJoobleJobs = (data.jobs || []).slice(0, 30).map((job) => ({
      _id: `jooble-${job.id}`,
      title: String(job.title || "Software Position").replace(/<[^>]+>/g, ""),
      company: job.company || "Unknown Company",
      location: job.location || "India",
      type: job.type || "Full Time",
      applyLink: job.link || "#",
      source: "Jooble"
    }))
  } catch (err) {
    console.error("Jooble fetch error:", err.message)
  } finally {
    lastJoobleFetchTime = Date.now()
  }
  return cachedJoobleJobs
}

export const getJobs = async (req, res) => {
  // Prevent 304 Not Modified browser caching on client
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")

  const indianApiKey = process.env.INDIAN_API_KEY
  const now = Date.now()

  // Only attempt fetch if cache duration has elapsed
  if (now - lastIndianFetchTime > INDIAN_CACHE_DURATION) {
    try {
      console.log("Fetching fresh jobs from IndianAPI (Quota request used)...")
      const indianApiRes = await axios.get("https://jobs.indianapi.in/jobs", {
        params: { limit: "20" },
        headers: { "X-Api-Key": indianApiKey || "" },
        timeout: 8000
      })

      const rawIndianJobs = Array.isArray(indianApiRes.data) ? indianApiRes.data : []

      if (rawIndianJobs.length > 0) {
        cachedIndianJobs = rawIndianJobs.slice(0, 15).map((job) => ({
          _id: String(job.id || Math.random()),
          title: job.title || job.job_title || "Software Position",
          company: job.company || "Unknown Company",
          location: job.location || "India",
          type: job.job_type || "Full Time",
          applyLink: job.apply_link || "#",
          source: "Tech Jobs" // Changed source tag name from IndianAPI to Tech Jobs
        }))
      }
    } catch (err) {
      console.error("IndianAPI Quota or Fetch Error (Cooling off API calls):", err.message)

    } finally {
      // CRITICAL FIX: Set fetch time regardless of success or failure to prevent repeated rate-limit hits
      lastIndianFetchTime = Date.now()
    }
  }
const joobleJobs = await fetchJoobleIndiaJobs()
  // Arbeitnow & Jobicy
  try {
    const [arbeitnowRes, jobicyRes] = await Promise.all([
      axios
        .get("https://www.arbeitnow.com/api/job-board-api", { timeout: 8000 })
        .catch(() => ({ data: { data: [] } })),

      axios
        .get("https://jobicy.com/api/v2/remote-jobs?count=20&geo=any", { timeout: 8000 })
        .catch(() => ({ data: { jobs: [] } }))
    ])

    // Format Arbeitnow Jobs
    const arbeitnowJobs = (arbeitnowRes.data?.data || []).slice(0, 15).map((job) => ({
      _id: job.slug || String(Math.random()),
      title: job.title,
      company: job.company_name,
      location: job.location || "Remote",
      type: job.job_types?.[0] || "Full-time",
      applyLink: job.url,
      source: "Arbeitnow"
    }))

    // Format Jobicy Jobs
    const jobicyJobs = (jobicyRes.data?.jobs || []).slice(0, 15).map((job) => ({
      _id: job.id?.toString() || String(Math.random()),
      title: job.jobTitle,
      company: job.companyName,
      location: job.jobGeo || "Remote",
      type: job.jobType?.[0] || "Full-time",
      applyLink: job.url,
      source: "Jobicy"
    }))

    const combined = [...joobleJobs,...cachedIndianJobs, ...arbeitnowJobs, ...jobicyJobs]

    res.status(200).json(combined)
  } catch (error) {
    console.error("Job fetching error:", error.message)
    res.status(500).json({ success: false, message: "Error fetching jobs", error: error.message })
  }
}