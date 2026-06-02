import CampaignForm from '@/components/Campaigns/CampaignForm';

export const metadata = {
  title: 'New Campaign',
};

export const dynamic = 'force-dynamic';

const NewCampaignPage = () => {
  return <CampaignForm mode="create" />;
};

export default NewCampaignPage;
