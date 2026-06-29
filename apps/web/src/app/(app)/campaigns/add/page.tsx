import CampaignForm from '@/components/Campaigns/CampaignForm';

export const metadata = {
  title: 'New Campaign',
};

export const dynamic = 'force-dynamic';

const AddCampaignPage = () => {
  return <CampaignForm />;
};

export default AddCampaignPage;
