jest.mock("@langchain/openai", () => {
  const { FakeListChatModel } = require("@langchain/core/utils/testing");
  class MockChatOpenAI extends FakeListChatModel {
    constructor() {
      super({ responses: ["Mock response"] });
    }
    bindTools() {
      return this;
    }
    withStructuredOutput() {
      return this;
    }
  }
  return { ChatOpenAI: MockChatOpenAI };
});
