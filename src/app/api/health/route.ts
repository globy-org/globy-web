export async function GET() {
  const url = `${process.env.API_BASE_URL}/health`
  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json()
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
  })
}
