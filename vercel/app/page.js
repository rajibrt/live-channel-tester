import IptvHomeClient from "../components/iptv/IptvHomeClient";
import { getHomeIptvData } from "../components/iptv/homeData";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getHomeIptvData();
  return (
    <IptvHomeClient
      initialChannels={data.channels}
      initialCategories={data.categories}
    />
  );
}
