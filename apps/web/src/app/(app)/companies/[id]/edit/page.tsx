'use client';

import CompanyForm from "@/components/Companies/CompanyForm";
import { Heading, Divider } from "@zuko/ui-kit";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/server/query-options";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

interface EditCompanyPageProps {
  params: Promise<{ id: string }>;
}

const EditCompanyPage = ({ params }: EditCompanyPageProps) => {
  const router = useRouter();
  const { id } = use(params);
  const companyId = parseInt(id, 10);
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.push("/sign-in");
    }
  }, [session.isPending, session.data, router]);

  const { data: company, isLoading: companyLoading } = useQuery({
    ...getCompany(companyId),
    enabled: !!session.data,
  });

  if (session.isPending || !session.data || companyLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Company not found</div>
      </div>
    );
  }

  const userId = parseInt(session.data.user.id, 10);

  return (
    <>
      <Heading>Edit Company</Heading>
      <Divider className="mt-6" />
      <div className="mt-8 max-w-2xl">
        <CompanyForm company={company} mode="edit" currentUserId={userId} />
      </div>
    </>
  );
};

export default EditCompanyPage;
