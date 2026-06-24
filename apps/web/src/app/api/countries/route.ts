import { COUNTRIES } from '@/lib/constants/countries';

export async function GET() {
  return Response.json(COUNTRIES);
}
