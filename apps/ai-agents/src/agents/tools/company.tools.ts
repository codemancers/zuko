import { tool } from "langchain";
import { Backend } from "../../shared/backend";
import { z } from "zod";
import { getUserContextFromConfig, Config } from "../utils";

export const getCompanyDetailsTool = tool(
  async (
    input: { companyId: number },
    config: Config
  ) => {
    const userContext = getUserContextFromConfig(config);
    const { userId, orgId: organisationId } = userContext || {};
    const { companyId } = input;

    if (!userId || !organisationId) {
      return {
        success: false,
        message: "User context (userId, organisationId) is required",
      };
    }

    try {
      const result = await Backend(`/companies/${companyId}`, {
        method: "GET",
        userId,
        organisationId,
      });

      return {
        success: true,  
        message: "Company fetched successfully",
        company: result.data,
      };
    } catch {
      return {
        success: false,
        message: "Failed to fetch company",
        company: null,
      };
    }
  },
  {
    name: "get_company_details",
    description: "Get a company by ID",
    schema: z.object({
      companyId: z.number().describe("The ID of the company to fetch"),
    }),
  }
);


export const companyTools = [getCompanyDetailsTool];