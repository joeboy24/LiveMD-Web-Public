export function GET() {
  return Response.json(
    {
      webcredentials: {
        apps: ["NV5799F3T4.PivoApps.net.LiveMD"],
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
