import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

export const getCheckpointer = async () => {
  const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL ?? "");
  await checkpointer.setup();
  return checkpointer;
};
