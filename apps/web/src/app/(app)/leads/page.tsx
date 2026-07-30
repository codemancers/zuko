import LeadsList from '@/components/Leads/LeadsList';

export const metadata = {
  title: 'Leads',
};

export const dynamic = 'force-dynamic';

const LeadsPage = () => {
  return <LeadsList />;
};

export default LeadsPage;
