// In-memory cache — countries don't change, so we fetch once per server lifetime.
let cachedCountries: { label: string; value: string }[] | null = null;

export async function GET() {
  if (cachedCountries) {
    return Response.json(cachedCountries);
  }

  const res = await fetch('https://restcountries.com/v3.1/all?fields=name', {
    // Next.js fetch cache as a secondary layer (survives cold starts in serverless)
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    return new Response('Failed to fetch countries', { status: 502 });
  }

  const data: { name: { common: string } }[] = await res.json();
  cachedCountries = data
    .map((c) => ({ label: c.name.common, value: c.name.common }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return Response.json(cachedCountries);
}
